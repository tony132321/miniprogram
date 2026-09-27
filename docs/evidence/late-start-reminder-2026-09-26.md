# Late prestart reminder suppression

The existing reminder job and external dispatch checked event status, version and consent, but not whether the event had already started. A late worker could create a new “start reminder” after start, and a previously queued reminder could still reach the provider after start.

Two database integration tests failed against the old implementation: the delayed job created four reminders, and a queued reminder invoked the adapter once after start. The reminder insertion now checks `clock_timestamp()` against the current event start on each insert. External dispatch checks the same boundary immediately before calling the provider and records `STALE_STATE` when it has passed. The positive control confirms that a consented prestart reminder still reaches the test adapter.

Verification on 2026-09-26:

- Focused notification suite: 11/11 passed after the fix; the two new regressions failed before it. The positive prestart send assertion passed in a subsequent focused run.
- Full `pnpm test`: 289/289 passed; `pnpm typecheck` and `git diff --check` passed.
- WeChat Developer Tools simulator compiled and opened `pages/me/me`. `GET /me/notifications?offset=0` returned HTTP 200; console search for `error` returned no matches. Screenshot: [wechat-late-reminder-page-2026-09-26.jpg](wechat-late-reminder-page-2026-09-26.jpg).

The simulator used an empty local development database and did not exercise a real subscription-message provider. Provider behavior here is asserted with a test adapter; true delivery and device notification remain external acceptance work.
