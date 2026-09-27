# Registration and pending interest at the write deadline

The v3.1 RSVP contract closes new participation at the registration deadline. Both normal registration and pending interest previously checked time before later database work, then wrote unconditionally. A request crossing the deadline during that work could create or reopen a row after cutoff.

Four transaction-injection tests failed against the old behavior: first registration INSERT, cancelled registration UPDATE, first interest INSERT, and cancelled interest UPDATE. The final SQL writes now compare the current event deadline to PostgreSQL `clock_timestamp()`. Zero returned rows raise `REGISTRATION_CLOSED` inside the transaction, rolling back the idempotency claim and any preceding promotion, audit, or outbox changes. Existing active registration replay behavior is preserved.

Verification on 2026-09-26:

- Focused crossing tests: 4/4 passed after all four had failed against the old behavior.
- `pnpm test`: 300/300 passed; `pnpm typecheck` and `git diff --check` passed.
- Fresh local PostgreSQL 18.6 test database `irl_r1_test_registration_interest_final_20260926`: migrations 1–26 passed; two connection pools and 100 contenders kept 4 confirmed seats and 99 waitlisted records; the new write-time checks reported `registrationWriteClockCrossPool=true` and `interestWriteClockCrossPool=true`.
- Updated WeChat Developer Tools reported `loginExpired=false`. A local development identity followed an invite link in the simulator and tapped the actual “本人报名或申请” button. Network returned HTTP 201; the page read the persisted `CONFIRMED` registration at event version 2. Screenshot: [wechat-registration-write-deadline-2026-09-26.jpg](wechat-registration-write-deadline-2026-09-26.jpg).

The simulator validates the normal interactive path. Deadline crossing was verified at database writes, where it can be controlled deterministically. This does not establish real-device, formal AppID, HTTPS domain, or live pilot acceptance.
