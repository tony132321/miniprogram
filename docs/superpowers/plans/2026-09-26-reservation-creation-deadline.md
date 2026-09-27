# Reservation Creation Deadline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Host reservations must not be created after the formation confirmation deadline, including when a bulk reservation request crosses that deadline between individual inserts.

**Architecture:** Keep the event lock, capacity check and idempotency transaction. Add a database clock condition to each reservation INSERT and reject zero inserted rows, causing earlier inserts and their jobs in the same transaction to roll back.

**Tech Stack:** TypeScript, node:test, PostgreSQL/PGlite.

**Spec:** `Project_IRL_Autonomous_Engineering_Package_v3.1/engineering/tasks/T15.md`.

## Global Constraints

- Preserve the existing token format, expiry value, and capacity accounting.
- Use the current event deadline and PostgreSQL clock at each write.
- Do not alter the mini-program UI.

## Review Focus

- Crossing before the second of two inserts leaves zero reservations, jobs, and audit rows for this action.
- Normal valid reservation creation and claim remain usable.
- Two-pool capacity checks remain intact.

---

### Task 1: Prevent expired reservation creation

**Files:** Modify `src/registrations.ts`; test `test/registrations.test.ts`; extend `scripts/verify-postgres.ts`.

- [x] Add a failing second-insert crossing test.
- [x] Confirm red failure comes from an unwanted successful reservation.
- [x] Guard each INSERT using the current event confirmation deadline and database clock; reject zero rows.
- [x] Run focused tests, full suite, typecheck and fresh PostgreSQL verification.
- [x] Record evidence and commit.
