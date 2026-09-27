# Notification Follow-up Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let operators see every pending notification follow-up and the true queue size when more than 100 records exist.

**Architecture:** Page the restricted queue 100 records at a time using a repeatable-read snapshot. The API rejects continuation when queue membership or ordering changes. The operations page appends later pages and restarts from page one on a stale snapshot.

**Tech Stack:** TypeScript, PostgreSQL/PGlite, Node HTTP, plain browser JavaScript.

**Spec:** `docs/superpowers/specs/2026-09-23-r1-functional-design.md`; PRD RQ12 and RQ18.

## Global Constraints

- Follow-up remains restricted by the `NOTIFICATIONS` operator permission.
- `UNAVAILABLE` plus unread, or `UNKNOWN_REQUIRES_RECONCILIATION`, remain the only pending external states.
- A follow-up record never changes or claims external delivery status.
- Keep the existing functional operations page; add only the control needed to reach later records.

## Review Focus

- 101 or more pending records: the last record can be reached.
- A newly handled or read notification between pages: return `QUEUE_CHANGED`, then reload page one.
- Missing or malformed continuation token: return a client error.
- Permission denied: do not expose queue rows or total.
- Failed continuation request: preserve the option to retry.

---

### Task 1: Page the restricted API

**Files:** Modify `src/notification-followups.ts`, `src/server.ts`; test `test/notification-followups.test.ts`.

**Interfaces:** `listNotificationFollowups(db, offset, snapshot)` returns `{ items, total, nextOffset, snapshot }`; GET `/ops/notifications/followups?offset=N&snapshot=HASH`.

- [x] Add failing tests with 105 pending records, duplicate-free two-page traversal, total, malformed continuation, and stale snapshot after a queue change.
- [x] Run focused tests and confirm expected failures.
- [x] Implement validation, repeatable-read count/snapshot and ordered 100-row page; pass query parameters through the permission-protected route.
- [x] Run focused tests and typecheck.

### Task 2: Reach later pages in operations

**Files:** Modify `operations/index.html`; test `test/operator-ui.test.ts`.

**Interfaces:** Add `moreNotificationFollowups` button; fetch later pages using the API snapshot.

- [x] Add failing UI tests for button state, append, stale refresh, and retry after failure.
- [x] Run focused tests and confirm expected failures.
- [x] Implement the loader, render helper, next-page handler, and true total in the status line.
- [x] Run focused tests and typecheck.

### Task 3: Verify and record

**Files:** Update `docs/acceptance-matrix.md` and add a short evidence note under `docs/evidence/`.

- [x] Run full `pnpm test`, `pnpm typecheck`, and `git diff --check`.
- [x] Record exactly what local evidence proves and what WeChat authorization and real-world resources still block.
- [x] Commit the verified change.
