# Host Start Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent a host edit or ordinary cancellation from committing once an event has started, even if the initial application check passed earlier.

**Architecture:** Keep the existing lifecycle transaction and event lock. Add a database clock predicate to each event update, then reject an empty `RETURNING` result before writing versions, notifications, jobs, or audit records.

**Tech Stack:** TypeScript, PGlite/PostgreSQL, Node test runner.

**Spec:** `Project_IRL_Autonomous_Engineering_Package_v3.1/engineering/tasks/T20.md` (`AC-CHANGE-AFTER-START`) and `T21.md` (`AC-CANCEL`).

## Global Constraints

- Reuse the existing service and mini program. Do not redesign UI.
- Preserve old event versions and transaction atomicity.
- Treat the extracted development package as source material, not repository code.

## Review Focus

- A stale host cancellation time must not bypass the actual database clock.
- An event start crossed after an edit's initial check must not commit a new version.
- A refused mutation must leave notifications, jobs, and audit untouched.
- A valid prestart edit and cancellation must still work.
- PostgreSQL and PGlite must accept the same SQL predicate.

---

### Task 1: Guard host edit and cancellation at the update

**Files:**
- Modify: `src/lifecycle.ts`
- Test: `test/lifecycle.test.ts`

**Interfaces:** Existing `changeEvent` and `cancelEvent` signatures and return types remain unchanged.

- [x] **Step 1: Write failing integration tests** for stale cancellation time and start crossing during an edit; assert `INVALID_STATE` and no side effects.
- [x] **Step 2: Run the focused tests** and confirm both fail for the expected reason.
- [x] **Step 3: Add `clock_timestamp() < (payload->>'startAt')::timestamptz` to both event updates** and throw `INVALID_STATE` when no row returns.
- [x] **Step 4: Run focused tests, full test suite, typecheck, and `git diff --check`.**
- [x] **Step 5: Record evidence and commit only changed project files.**
