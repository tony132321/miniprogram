# Registration Write Deadline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** A registration or pending interest cannot be created or reopened after the event's registration deadline, even if the deadline passes while the request is in progress.

**Architecture:** Keep the existing event row lock, capacity calculation, idempotency transaction, and registration states. Add the final deadline predicate to both registration write statements using PostgreSQL `clock_timestamp()` and the current event payload; reject zero returned rows with `REGISTRATION_CLOSED` so the whole transaction rolls back.

**Tech Stack:** TypeScript, node:test, PostgreSQL/PGlite.

**Spec:** `Project_IRL_Autonomous_Engineering_Package_v3.1/engineering/tasks/T14.md`; `Project_IRL_Autonomous_Engineering_Package_v3.1/specs/acceptance_cases.json`.

## Global Constraints

- Reuse the current implementation and preserve idempotent responses for existing active registrations.
- Do not change the user interface.
- Deadline decisions must use the database clock at the write.

## Review Focus

- A first registration crossing the deadline must leave no registration, notification, or audit.
- Rejoining from CANCELLED across the deadline must leave the cancelled row unchanged.
- A first or renewed pending interest must follow the same deadline rule.
- A normal valid registration must still get its existing state and response.
- Capacity and waitlist order must remain stable.
- A repeated successful idempotency key must return its saved result.

---

### Task 1: Guard first and renewed registrations

**Files:** Modify `src/registrations.ts`; test `test/registrations.test.ts`.

- [x] Add a failing transaction-injection test for first INSERT crossing the deadline.
- [x] Add a failing transaction-injection test for renewed UPDATE crossing the deadline.
- [x] Run focused tests and confirm expected red failures.
- [x] Add the deadline predicate to both writes and reject zero returned rows.
- [x] Run focused and full tests, typecheck, and PostgreSQL concurrency verification.
- [x] Record evidence and commit the change.

### Task 2: Guard pending interest writes

**Files:** Modify `src/registrations.ts`; test `test/registrations.test.ts`.

- [x] Add failing tests for first interest and renewed interest crossing the deadline at their writes.
- [x] Run focused tests and confirm expected red failures.
- [x] Add the same database clock predicate to both interest writes and reject zero returned rows.
- [x] Rerun focused, full, typecheck, and independent PostgreSQL verification.
