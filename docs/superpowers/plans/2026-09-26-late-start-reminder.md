# Late Start Reminder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop prestart reminders from being created or externally sent after the event start has passed.

**Architecture:** The reminder job checks the event's current start against database time before enqueueing. External dispatch checks it again immediately before provider invocation so an already queued reminder becomes stale when processing is delayed.

**Tech Stack:** TypeScript, PGlite/PostgreSQL, Node test runner.

**Spec:** `Project_IRL_Autonomous_Engineering_Package_v3.1/engineering/tasks/T18.md` (`AC-NOTIFY-CANCELLED`) and `T21.md` (`AC-NOTIFY-CANCELLED`).

## Global Constraints

- Retain the current in-app notification history and external status vocabulary.
- Do not call real providers in tests.
- Preserve event and notification transaction locking.

## Review Focus

- A delayed reminder job must not create a new start reminder after start.
- A queued start reminder must not be sent externally after start.
- Cancellation and registration exit continue suppressing stale reminders.
- Valid prestart reminder creation and dispatch remain allowed.
- Provider failures remain in the existing reconciliation path.

---

### Task 1: Suppress late start reminders

**Files:**
- Modify: `src/jobs.ts`, `src/notifications.ts`
- Test: `test/notifications.test.ts`

**Interfaces:** Existing `runDueJobs`, `dispatchNotification`, and adapter signatures remain unchanged.

- [x] **Step 1: Add failing integration tests** for late job creation and delayed provider dispatch.
- [x] **Step 2: Run focused tests to confirm the existing code creates or sends stale reminders.**
- [x] **Step 3: Add database-clock start checks in job and dispatch paths.**
- [x] **Step 4: Run focused and full tests, typecheck, and diff checks.**
- [x] **Step 5: Record evidence and commit exact project files.**
