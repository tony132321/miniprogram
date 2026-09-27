# Confirmation deadline write boundary

The v3.1 formation and reconfirmation rules require the current confirmation deadline to govern the final write. Both lifecycle commands previously checked a JavaScript timestamp before later database work. A request held long enough to cross the deadline could still commit.

Two database integration tests were added before the fix. The first changes the event deadline immediately before the host's final status update, representing time crossing after validation. The second sends an old request time after the current deadline has passed. Against the previous implementation, both tests failed because the forbidden writes succeeded.

The final `UPDATE` statements now require `clock_timestamp()` before the event's current confirmation deadline. An empty result raises `INVALID_STATE` inside the existing transaction. The host path cannot create a formation audit or notification; the participant path cannot record fresh consent after the deadline. Valid predeadline flows remain covered by the existing suite.

Verification on 2026-09-26:

- Focused regressions: 2 passed after the change; both failed before it.
- `pnpm typecheck`: passed.
- `pnpm test`: 287 passed, 0 failed.
- `git diff --check`: passed.

These tests use the local PGlite PostgreSQL engine. This change has not been separately exercised against a running remote PostgreSQL instance or a true device; the SQL predicates need deployment-environment verification during candidate acceptance.
