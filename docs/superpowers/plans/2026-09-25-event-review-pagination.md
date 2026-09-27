# Public Event Review Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure operators can reach every pending public event review and see the actual backlog size.

**Architecture:** Return ordered pages of 100 under a repeatable-read queue snapshot. Reject continuation when event review membership, version or ordering changes. The operations page appends later pages and restarts at page one when its snapshot becomes stale.

**Tech Stack:** TypeScript, Node HTTP, PostgreSQL/PGlite, plain browser JavaScript.

**Spec:** `docs/superpowers/specs/2026-09-23-r1-functional-design.md`; PRD RQ03 and RQ19.

## Global Constraints

- Only operators with `EVENT_REVIEWS` can read and decide public reviews.
- Approval remains version-bound and never publishes an unreviewed version.
- Keep the existing functional operations page layout and copy style.

## Review Focus

- More than 100 pending events: no case is hidden after paging.
- A decision or edit between pages: reject the stale continuation.
- Invalid offset or missing snapshot: return 400.
- Denied permission: do not expose rows or the queue count.
- Failed page read: preserve a retry path in the workbench.

---

### Task 1: Page the review API

**Files:** Modify `src/event-review.ts`, `src/server.ts`; test `test/event-review.test.ts`; adapt any direct callers.

**Interfaces:** `listPendingEventReviews(db, offset, snapshot)` returns `{items,total,nextOffset,snapshot}`. GET `/ops/events/reviews?offset=N&snapshot=HASH`.

- [x] Add failing tests for 105 pending reviews, page traversal, invalid continuation and stale snapshot.
- [x] Run focused tests and confirm the expected failure.
- [x] Implement validated parameters, repeatable-read snapshot and ordered page.
- [x] Run focused tests and typecheck.

### Task 2: Expose later reviews in operations

**Files:** Modify `operations/index.html`; test `test/operator-ui.test.ts`.

- [x] Add failing tests for total, append, stale refresh and retry.
- [x] Run focused tests and confirm the expected failure.
- [x] Add a load-more button, page state and render helper.
- [x] Run focused tests and typecheck.

### Task 3: Verify and record

**Files:** Update `docs/acceptance-matrix.md` and `docs/evidence/`.

- [x] Run full `pnpm test`, `pnpm typecheck` and `git diff --check`.
- [x] Record local evidence and the remaining WeChat and real-world verification gaps.
- [x] Commit the verified work.
