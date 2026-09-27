# Host edit and cancellation start boundary

The v3.1 `AC-CHANGE-AFTER-START` rule requires host edits and ordinary cancellations to stop after the event starts. Both lifecycle handlers already checked the start time before later database work, but their final `UPDATE events` statements did not check it again. A delayed request could therefore cross the start boundary before committing.

The integration tests first failed against the old code: stale-time cancellation and an edit whose event started between validation and update both completed when `INVALID_STATE` was expected. The update now uses PostgreSQL `clock_timestamp()` in the `WHERE` clause and rejects zero updated rows. Rejection rolls back the transaction before event versions, notices, jobs, or audit are written.

Verification on 2026-09-26:

- Focused regression tests: 2 passed after the fix; both failed before it.
- `pnpm typecheck`: passed.
- `pnpm test`: 285 tests passed, 0 failed.
- `git diff --check`: passed.
- Updated WeChat Developer Tools: `check_wechatide_status` reported `loginExpired=false`; `simulator_open_page` compiled and opened `pages/index/index`; simulator network showed `GET /me/events` returned HTTP 200; console search for `error` returned no matches. Screenshot: [wechat-ide-post-update-2026-09-26.jpg](wechat-ide-post-update-2026-09-26.jpg).

The simulator check covers local compilation, navigation, and API connectivity. The two start boundary cases were verified at the database integration level, where the actual write-time predicate runs.
