# Bulk reservation creation at the confirmation deadline

The v3.1 reservation contract requires real capacity accounting and expiring host reservation tokens. The existing bulk command checked the confirmation deadline once before entering its insert loop. If time crossed the deadline during the loop, it could return already expired tokens and leave their expiry jobs queued.

A two-token transaction test first failed against the old implementation: the deadline was moved to the past immediately before the second insert, yet the command returned success. Each reservation INSERT now checks the current event confirmation deadline and PostgreSQL `clock_timestamp()`. If any insert returns zero rows, the command raises `INVALID_RESERVATION`, rolling back prior tokens, expiry jobs and idempotency state.

Verification on 2026-09-26:

- Focused tests: deadline crossing and normal reservation behavior both passed after the change.
- Full `pnpm test`: 301/301 passed; `pnpm typecheck` and `git diff --check` passed.
- Fresh local PostgreSQL 18.6 database `irl_r1_test_reservation_creation_20260926`: migrations 1–26 passed; two pools and 100 contenders kept 4 confirmed seats and 99 waitlisted records; `reservationCreationClockCrossPool=true` verified rollback on the second insert. The existing valid reservation claim and expiry checks also passed.
- Updated WeChat Developer Tools simulator: the host opened a newly published activity and tapped the existing “预留一个球友名额” button. The page read back `reserved=1` and showed a returned claim token. Screenshot: [wechat-reservation-creation-deadline-2026-09-26.jpg](wechat-reservation-creation-deadline-2026-09-26.jpg). An invisible element ID was added to make the real button tap target stable for regression automation.

The simulator covers the valid interactive path. The exact cutoff crossing is database boundary evidence; a true device and target deployment still require their own verification.
