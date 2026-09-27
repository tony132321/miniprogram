# Seat Token Expiry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent a waitlist offer or host reservation from being consumed after its actual database expiry.

**Architecture:** Keep the event and token row locks. Change the token-state transition to a conditional SQL `UPDATE` that uses `clock_timestamp()` and returns a row only if the token is still active. Apply the registration seat change in the same transaction after the token claim succeeds.

**Tech Stack:** TypeScript, PGlite/PostgreSQL, Node test runner.

**Spec:** `Project_IRL_Autonomous_Engineering_Package_v3.1/specs/TRANSACTIONS_AND_JOBS.md` section 3 and `engineering/tasks/T17.md` (`AC-RECOVERY`).

## Global Constraints

- The activity row remains the capacity serialization point.
- Failed claims leave registration, token, audit and outbox unchanged.
- Preserve existing errors, idempotency and event version checks.
- Reuse existing database schema and mini program UI.

## Review Focus

- Offer expiry crossing after an initial read rejects acceptance.
- Reservation expiry crossing after an initial read rejects claim.
- Valid preexpiry offer and reservation claims still work.
- Worker replay cannot create a second seat after token consumption.
- PostgreSQL database time decides the transition, not a previously captured JavaScript time.

---

### Task 1: Conditional token transitions

**Files:**
- Modify: `src/registrations.ts`
- Modify: `scripts/verify-postgres.ts` (migration count was stale at 24; current schema has 26)
- Test: `test/registrations.test.ts`

**Interfaces:** `acceptOffer` and `claimReservation` signatures and result types remain unchanged.

- [x] **Step 1: Add failing integration tests** that move each token expiry after validation and before its state update.
- [x] **Step 2: Run focused tests and confirm the old code wrongly consumes both tokens.**
- [x] **Step 3: Claim token state with database-clock conditions and reject zero-row updates.**
- [x] **Step 4: Run focused and full tests, typecheck, real PostgreSQL verification, and diff checks.**
- [x] **Step 5: Record evidence and commit exact project files.**
