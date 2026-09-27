# Offer and reservation expiry at the token write

The v3.1 transaction contract says offer acceptance and expiry compete under the event and token locks, with database time deciding the winner. The existing service read database time, then performed unconditional token updates. A request could cross expiry between those two operations and still create a confirmed seat.

Two integration regressions failed against the old code: a waitlist offer and a host reservation each became expired immediately before their token update, but the old request succeeded. Both token transitions now use `clock_timestamp()` in conditional SQL updates. A zero-row result raises the existing unavailable error inside the transaction. The reservation token is claimed before the registration seat is changed. On rejection, token, registration, audit and outbox writes roll back together.

Verification on 2026-09-26:

- Focused tests: 4/4 passed, including valid preexpiry acceptance and reservation claim. Both new late-token cases failed before the fix.
- Full `pnpm test`: 296/296 passed; `pnpm typecheck` and `git diff --check` passed.
- Fresh local PostgreSQL 18.6 database `irl_r1_test_token_20260926c`: migrations 1–26 passed, two connection pools ran 100 last-seat contenders (`confirmed=4`, `waitlisted=99`), and the existing offer/expiry and reservation/expiry cross-pool checks passed. New write-time crossing checks reported `offerWriteClockCrossPool=true` and `reservationWriteClockCrossPool=true`. `scripts/verify-postgres.ts` was updated from its stale 24-migration expectation to the current 26. The temporary server was stopped after verification; this was a local test instance, not a target deployment.
- WeChat Developer Tools simulator: development user `w1` opened an in-app waitlist offer, tapped the actual “主动确认补位” button before expiry, received HTTP 200, and `/me/registrations` read back `CONFIRMED` at event version 2. The development identity was restored to `host` after testing. Screenshot: [wechat-offer-token-boundary-2026-09-26.jpg](wechat-offer-token-boundary-2026-09-26.jpg).

The simulator covers the valid interactive path. The exact expiry crossing is deterministic at the database layer and cannot be inferred from a normal tap. True device interaction, production database operations and real external notification delivery remain separate acceptance work.
