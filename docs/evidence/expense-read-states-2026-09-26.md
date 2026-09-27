# PG09 expense read states and access boundary

The previous event-page refresh converted every expense API failure into `{ items: [] }`. This could display a temporary failure or permission denial as if no ledger existed. The server also returned 403 to a confirmed member before the host created the first ledger.

The service now returns an empty list to a confirmed or reconfirming member when no share exists, while an unrelated account still receives 403. It checks current membership before reading a non-host ledger and within the ledger query; a cancelled or removed member cannot read an old share or update their former payment-handling flag. The event page keeps expense read state separate from the activity detail: `EMPTY`, `READY`, `FORBIDDEN`, or `ERROR`. An error clears any previously displayed ledger and provides a retry through the existing activity refresh. Until the read succeeds, the host's ledger recording button says the record is unavailable and is disabled. The rest of the event detail remains available.

Verification on 2026-09-26:

- Focused PGlite tests reproduced both old behaviors before the change and passed after it. An isolated local HTTP run returned 200 with `items: []` for a confirmed member and 403 `FORBIDDEN` for an outsider.
- Fresh PostgreSQL 18.6 database `irl_r1_test_expense_review_20260926`, 26 migrations and two connection pools: `emptyExpenseMemberCrossPool=true`; the existing 100-contender test ended with 4 confirmed and 99 waitlisted. PGlite regression additionally checks cancellation and removal after ledger creation, including denial of further participant writes.
- In WeChat Developer Tools `0.3.11`, an isolated PGlite backend and temporary local proxy made only the expense GET return 503. The simulator displayed [the error and retry button](wechat-expense-retry-error-2026-09-26.jpg). After the proxy resumed normal forwarding, an actual tap on `#expenseRetryButton` changed runtime `expenseLoadState` from `ERROR` to `EMPTY` and displayed [the empty ledger state](wechat-expense-retry-empty-2026-09-26.jpg). The final candidate was reopened in the simulator: on `ERROR`, `#recordExpenseButton` was disabled and read “费用记录暂不可用”; after retry reached `EMPTY`, it was enabled and read “记录 AA 分摊”. The local servers were stopped and temporary proxy code removed.
- Full `pnpm test` 315/315 passed; `pnpm typecheck`, `git diff --check`, and the WeChat Developer Tools `pages/event/event.wxml` compiler passed. Independent review identified former-member access and an enabled host write button during expense-read failure; both were fixed and covered by the final verification.

This verifies local service behavior and simulator interaction. Real-device network recovery and formal account permissions remain unverified.
