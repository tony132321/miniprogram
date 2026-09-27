# Notification failure follow-up implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put failed or uncertain external notifications into a restricted operator queue and retain manual follow-up evidence without claiming delivery.

**Architecture:** A new `NOTIFICATIONS` operator permission protects a minimal metadata queue. Version 9 adds a one-to-one follow-up table keyed by notification ID. Operators can record a 5–500 character conclusion; the row and audit trail remove the item from the pending queue, while the original external status remains intact.

**Tech Stack:** TypeScript, Node HTTP, PostgreSQL/PGlite, existing workbench.

**Spec:** `/Users/tsb/Downloads/01_PRD_v1.0.md` RQ12 (§11), especially external receipt uncertainty and human handling.

## Global Constraints

- `PROVIDER_ACCEPTED` is not delivery. A follow-up is not delivery either.
- Do not retry uncertain provider sends automatically.
- Consent withdrawal and stale version/state suppression are not provider failures.
- Show only event ID, user ID, kind, external status, and timestamps; keep notification detail private.

## Review Focus

- A user who opens an in-app notification after `UNAVAILABLE` no longer needs a follow-up item.
- `UNKNOWN_REQUIRES_RECONCILIATION` stays visible even if the in-app notification is opened.
- Operators without `NOTIFICATIONS` cannot list or write follow-up records.
- Repeated idempotency keys return one result and one audit record.
- Gate notices intentionally marked `UNAVAILABLE` have no external send job and do not enter the queue.

---

### Task 1: Queue and recorded conclusion

**Files:** Create `src/migrations/0009_notification_followups.sql`, `src/notification-followups.ts`, `test/notification-followups.test.ts`; modify `src/db.ts` and migration assertions.

**Interfaces:** `listNotificationFollowups(db)` returns restricted pending metadata. `recordNotificationFollowup(db, actor, notificationId, note, key)` records manual handling, without mutating `external_status`.

- [x] Write tests for failure states, opened state, gate exclusion, duplicate handling, and audit.
- [x] Run targeted tests and observe failures caused by the missing feature (404 for missing route).
- [x] Add migration and functions.
- [x] Run targeted tests until green.

### Task 2: Protected HTTP route and workbench

**Files:** Modify `src/operator-auth.ts`, `src/server.ts`, `operations/index.html`, `test/operator-permissions.test.ts`, `test/operator-ui.test.ts`, docs.

**Interfaces:** GET `/ops/notifications/followups` and POST `/ops/notifications/:id/followup` require `NOTIFICATIONS`.

- [x] Write failing production-role and UI tests (workbench omitted pending count).
- [x] Add route, permission, and a plain metadata list with note input.
- [x] Run full test suite, typecheck, and PostgreSQL verification. This operator-only change does not touch mini-program pages.
- [x] Review and document evidence; no blocking findings. Commit follows final verification.

## Review ledger

- Task 1: complete. Targeted test failed with 404 before implementation, then passed; migration 9 and PostgreSQL two-pool verification passed.
- Task 2: complete. Workbench count test failed before implementation, then passed; production permission test passed; full suite 107/107 and typecheck passed.
- Final review: no blocking finding. The completed-record view identified as a minor gap was added in the next iteration and is restricted by the same `NOTIFICATIONS` permission.
