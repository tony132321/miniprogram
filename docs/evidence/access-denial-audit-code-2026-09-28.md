# T28 AC-PERMISSION · local code evidence

Candidate files: `src/access-denial-audit.ts`, `src/server.ts`, `test/access-denial-audit.test.ts`.

The HTTP error boundary records every application 403 and protected-route 404 in the existing `audit` table. It stores a salted actor pseudonym, authentication class, static route template, error code, generated request ID, and database timestamp. The request ID is also returned in `X-Request-Id`. It does not store the raw URL, query, bearer token, request body, or sensitive object ID. If audit persistence fails, the original denial still goes to the client.

The HTTP regression covers an outsider requesting another event's member list and expenses, operations report endpoints, and another member's export ticket. It verifies 403/404 responses, no business-row writes, scrubbed audit contents, and the original 403 when audit storage fails.

2026-09-29 review addendum: a protected URL longer than eight segments now stays auditable as fixed `UNMAPPED_ROUTE`, and the reservation-claim prefix is included. Both cases have focused regression coverage; the unavailable reservation token returns 404 with a redacted audit row. This closes two paths that previously bypassed the protected-404 audit.

Evidence: `node --import tsx --test test/access-denial-audit.test.ts` passed 4/4 after the review fixes; `pnpm typecheck` and `git diff --check` passed. Initial test reproduced the original broad gap with zero denial audit rows. The full suite ran 627/627 before the two review cases were added; those cases were then run as targeted tests.

This is local PGlite evidence. PostgreSQL concurrency, deployed log pipeline handling, and live operator permissions still require target-environment validation.
