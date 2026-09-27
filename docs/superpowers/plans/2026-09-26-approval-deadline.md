# Approval Deadline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent manual approval of a pending registration once recruitment has ended, even if a deadline worker has not run.

**Architecture:** Keep the event row lock, capability and capacity checks. Check the current registration deadline and active recruiting status before work, and require database time to remain before the deadline in the final registration update.

**Tech Stack:** TypeScript, PGlite/PostgreSQL, Node test runner.

**Spec:** `Project_IRL_Autonomous_Engineering_Package_v3.1/engineering/tasks/T14.md` (`AC-RQ06`, `AC-APPROVAL-LAST-SEAT`) and `T19.md` (`AC-RQ09`).

## Global Constraints

- Pending requests hold no seats.
- Approval must not exceed capacity or bypass event risk gates.
- Preserve current route, idempotency and version contracts.
- Do not alter mini program appearance.

## Review Focus

- An approval after the current registration deadline is rejected even if background jobs lag.
- A request crossing the deadline after initial validation cannot commit a seat.
- An event no longer recruiting cannot approve requests.
- A valid predeadline request remains approvable.
- Rejection leaves registration and audit records unchanged.

---

### Task 1: Guard manual approval at the deadline

**Files:**
- Modify: `src/registrations.ts`
- Test: `test/registrations.test.ts`

**Interfaces:** `approveRegistration` retains its current signature and `Registration` result.

- [x] **Step 1: Add failing integration tests** for a late approval and a deadline crossing just before the update.
- [x] **Step 2: Run focused tests and verify old code accepts both writes.**
- [x] **Step 3: Add deadline and status checks, including a database-clock predicate on the final update.**
- [x] **Step 4: Run focused and full tests, typecheck, and diff checks.**
- [x] **Step 5: Record evidence and commit exact project files.**
