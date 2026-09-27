# Offer Dispatch Gates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop queued waitlist offers from being externally sent while their event is held or public recruitment is closed.

**Architecture:** Recheck active event holds and the public recruitment gate within the existing dispatch transaction immediately before invoking the provider. Hold database share locks through the provider call, matching the current event, registration, consent and emergency checks.

**Tech Stack:** TypeScript, PGlite/PostgreSQL, Node test runner.

**Spec:** `Project_IRL_Autonomous_Engineering_Package_v3.1/engineering/tasks/T29.md` (`AC-SAFETY`) and `T18.md` (`AC-NOTIFY-CANCELLED`).

## Global Constraints

- Reuse the current notification adapter and `STALE_STATE` status.
- Preserve private invitation events when only public recruitment is closed.
- Keep existing event and gate transactions atomic.

## Review Focus

- A queued offer is not sent after an event safety hold is placed.
- A queued offer for a public event is not sent after public recruitment closes.
- A private event's offer remains eligible during a public-only closure.
- An active offer before gates close remains eligible with consent.
- Provider uncertainty is still handled by the existing path.

---

### Task 1: Recheck risk gates at offer dispatch

**Files:**
- Modify: `src/notifications.ts`
- Test: `test/notifications.test.ts`

**Interfaces:** `dispatchNotification` and `NotificationAdapter` retain their signatures.

- [x] **Step 1: Add failing integration tests for hold and public gate closure.**
- [x] **Step 2: Run focused tests to prove queued offers still send in the old code.**
- [x] **Step 3: Read held and public gate state in the dispatch transaction and reject ineligible offers.**
- [x] **Step 4: Verify focused and full tests, typecheck, and diff checks.**
- [x] **Step 5: Record evidence and commit only project files.**
