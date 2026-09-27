# Confirmation Deadline Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent event formation and personal reconfirmation from committing after the current confirmation deadline.

**Architecture:** Keep the existing locked lifecycle transactions. Use the database clock at each final write, reject an empty update, and let the transaction roll back all earlier work.

**Tech Stack:** TypeScript, PGlite/PostgreSQL, Node test runner.

**Spec:** `Project_IRL_Autonomous_Engineering_Package_v3.1/engineering/tasks/T19.md` (`AC-RQ09`) and `T20.md` (`AC-RQ10`).

## Global Constraints

- Reuse current lifecycle routes and database schema.
- Do not change mini program visual design.
- Preserve immutable event versions, idempotency, and transaction atomicity.

## Review Focus

- A host confirmation delayed past the deadline cannot form the event.
- A participant's stale request time cannot renew consent after the deadline.
- Rejected writes do not enqueue formation messages or create audit claims.
- Current predeadline flows continue to pass.
- Both supported PostgreSQL engines accept the SQL predicate.

---

### Task 1: Enforce confirmation deadline at write time

**Files:**
- Modify: `src/lifecycle.ts`
- Test: `test/lifecycle.test.ts`

**Interfaces:** Existing `confirmEvent` and `reconfirm` signatures remain unchanged.

- [x] **Step 1: Add deterministic failing tests** for deadline crossing after host checks and a stale participant request time.
- [x] **Step 2: Run focused tests and confirm the old writes are accepted.**
- [x] **Step 3: Add database-clock predicates to both final updates and reject empty results.**
- [x] **Step 4: Run focused tests, full tests, typecheck, and diff checks.**
- [x] **Step 5: Save evidence and commit exact project files.**
