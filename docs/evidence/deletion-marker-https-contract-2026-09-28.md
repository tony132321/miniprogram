# HTTPS deletion marker adapter contract and local evidence

`HttpsDeletionMarkerStore` implements the existing `DeletionMarkerStore` interface. The adapter is code-ready for a separately operated HTTPS service; no such service, TLS identity, token, durable storage, or deployment has been verified here. Production startup requires `DELETION_MARKER_URL`, `DELETION_MARKER_TOKEN`, and an approved `RETENTION_POLICY_JSON`; it rejects the local `DELETION_MARKER_PATH`. It reads a complete remote snapshot before opening the database, replays it after database connection, and only then starts listening.

## Endpoint contract

The configured base URL must use HTTPS and must not contain URL credentials, query, or fragment. The client calls `<base>/v1/markers` with `Authorization: Bearer <token>`, `Accept: application/json`, a five-second timeout, and redirects disabled. The service must run outside the application database and every backup/restore scope for that database.

`POST /v1/markers` receives exactly:

```json
{"schema":"project-irl/deletion-marker-v1","requestId":"request-1","userId":"person-1","policySha256":"<64 lowercase hex>","recordedAt":"2026-09-28T00:00:00.000Z"}
```

It must atomically commit the immutable marker to durable storage before returning HTTP 201 with JSON:

```json
{"schema":"project-irl/deletion-marker-ack-v1","markerSha256":"<digest>","durable":true,"immutable":true}
```

`markerSha256` is SHA-256 of UTF-8 `JSON.stringify` of the marker with keys ordered `schema`, `requestId`, `userId`, `policySha256`, `recordedAt`. An error, timeout, missing flag, other status, or mismatched digest must never be treated as a committed marker. Repeated appends may create duplicate identical-intent markers; the service must never overwrite or remove a committed marker.

`GET /v1/markers?offset=0` returns the first page. Later pages use `offset=<nextOffset>&snapshot=<snapshotSha256>`. Every page returns JSON with `schema: "project-irl/deletion-marker-list-v1"`, `snapshotSha256`, `total`, `offset`, `markers` (at most 1000), `nextOffset` (integer or null), `complete` (boolean), `durable: true`, and `immutable: true`. `total` is at most 100000 for this pilot client. All pages must describe one unchanged complete snapshot; the service should reject a request if the snapshot changed between pages. The digest is SHA-256 of UTF-8 `JSON.stringify` of the complete marker array, with every marker's keys ordered as above. The final page has `complete: true`, `nextOffset: null`, and the client verifies row count and digest. Any gap, conflicting snapshot, malformed record, oversized page, or unavailable service fails startup closed. The bounded client response limit is 2 MB per page and 1000 pages.

The service's `durable` and `immutable` claims need independent deployment proof: storage topology, access control, TLS certificate validation, append fsync or transactional commit, backup exclusion/segregation, restore rehearsal, and retention monitoring. A matching service response alone cannot prove those properties.

## Local checks

Synthetic protocol tests cover correct append acknowledgement, multi-page replay, mismatched digest, incomplete list, unsafe URL, network failure, and secret-free errors. Startup tests cover missing or unreachable service before database connection. A scheduled quarantine cleanup runs hourly only when deletion marker configuration is present, with one sweep at a time; the scheduling test covers overlap and stop behavior. Targeted tests: 17/17 passed; TypeScript `tsc --noEmit` passed. These results do not validate an external service or production backup lifecycle.
