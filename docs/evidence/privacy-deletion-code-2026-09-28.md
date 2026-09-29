# Privacy deletion code evidence — 2026-09-28

## Implemented scope

- A DELETE request can be previewed without mutation. Execution requires an explicitly approved retention policy and a durable deletion marker source. The execution path disables the account, revokes sessions and export tickets, closes hosted recruitment and invite tokens, isolates mapped dispute originals, and deidentifies mapped shared activity links and host-authored text. It keeps the request in `SAFEGUARDS_APPLIED_PENDING_REVIEW`.
- The execution receipt records purpose-level outcomes and a machine-readable `pendingReviews` inventory. It does not report `FULFILLED` while unresolved data classes remain.
- Restoring an older local backup requires marker replay. Replay re-applies the protective phases, preserves the first marker time for policy-driven expiry, and purges due quarantine and AI input. An unavailable or mismatched marker source or policy fails closed.
- The marker is an irrevocable execution intent. The writer holds the user and request locks through marker fsync and the matching `EXECUTION_INTENT_RECORDED` commit. A startup replay completes work left by a crash after fsync; conflicting policy retries are rejected before another marker is written.
- Shared event deidentification scans again for late relational writes. Per-event tombstones are recorded; an occupied deterministic candidate is skipped before uniqueness constraints can collide. The dispute receipt says `PARTIALLY_ISOLATED_REVIEW_PENDING` and lists remaining dispute-related copies.
- Synthetic integration coverage includes two distinct fact questions sharing one activity, non-deleted member event access and exit after host deidentification, late relational writes, an occupied tombstone candidate, failed safeguards and post-fsync rollback recovery, and duplicate marker recovery without extending retention.

## Remaining code and operational gates

- [AI input expiry](privacy-ai-expiry-2026-09-28.md) and [ordinary profile expiry](privacy-ordinary-profile-expiry-2026-09-28.md) now run only when the matching owner-approved policy names `DELETE_EXECUTION` and an explicit period. They clear selected content and retain cost, delivery, audit and safety evidence under narrower pending-review categories. Real policy approval and proof of actual production disposition are still open.
- Notification detail, consent history, other free text and opaque JSON, audit and idempotency records, and external delivery logs need field-level inventory and treatment.
- Provider copies and historical production backups need external deletion or retention evidence. The local marker file adapter is a single-writer rehearsal adapter; production needs a separately durable protected store.
- Quarantine is application-level isolation in the same database. Hourly maintenance now also sweeps eligible AI input and ordinary-profile expiry, while startup replay applies deadlines derived from the earliest durable marker. Production database role separation and scheduled execution are not verified.
- The shared-identity write guard takes the real user's row `FOR SHARE NOWAIT` before checking deletion state. Local PGlite tests verify the guard and functional deletion paths. A later [two-connection PostgreSQL 18.6 race test](privacy-shared-write-race-postgres-2026-09-29.md) now verifies an ordinary content write before the real deletion sweep is scrubbed, a write attempted while deletion owns the user row is rejected without waiting, and the deleted identity cannot be reused after commit. The same script is included in CI. Other free-text and JSON paths still need field-level review.
- No real policy values, formal AppID, HTTPS API, provider deletion confirmation, physical-device run, or controlled live activities were supplied or inferred.

## Verification

Run `node --import tsx --test --test-isolation=none --test-concurrency=1` for:

- `test/privacy-deletion-execution.test.ts`
- `test/privacy-deletion-replay.test.ts`
- `test/privacy-quarantine.test.ts`
- `test/privacy-shared-deidentification.test.ts`

Also run `tsc --noEmit`. This document records targeted code-level verification only; it is not production acceptance evidence.
