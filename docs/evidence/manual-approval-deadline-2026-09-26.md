# Manual approval closes at registration deadline

Manual approval previously checked that the event was recruiting and had capacity, but did not check the registration deadline. A pending request could become a confirmed seat after cutoff if a background deadline task was late. The initial check also needed a final write-time guard so a slow request could not cross the cutoff during processing.

Two integration regressions failed before the fix: an already late request was approved, and a request whose deadline crossed immediately before the registration update was also approved. The handler now checks current database time, event status and recruiting state before capacity allocation. Its final `UPDATE registrations` requires the current event to remain recruiting and `clock_timestamp()` to be before the registration deadline. A rejected write leaves the request `REQUESTED` and creates no approval audit or notice.

Verification on 2026-09-26:

- Focused approval tests: 3/3 passed, including the existing valid predeadline approval. The two late cases failed before the fix.
- Full `pnpm test`: 294/294 passed.
- `pnpm typecheck` and `git diff --check`: passed.

WeChat Developer Tools simulator check: a local development server without its background timer hosted one manual-approval event and one `REQUESTED` applicant. The test fixture moved only the event's registration deadline into the past. As host, the simulator opened `pages/event/event`, showed that applicant, and tapped the actual “同意申请” button. The request returned HTTP 400 with `REGISTRATION_CLOSED`; page data showed “报名已截止，不能再批准申请”; authoritative host registration readback still showed `REQUESTED`. Screenshot: [wechat-manual-approval-deadline-2026-09-26.jpg](wechat-manual-approval-deadline-2026-09-26.jpg). The temporary local fixture was removed after testing.

The simulated deadline shift verifies the rejection path and page feedback. It does not establish natural timer operation, true device approval UX, or target-environment PostgreSQL operation; those remain separate candidate acceptance checks.
