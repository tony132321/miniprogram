# PostgreSQL Integration Verification Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Verify the production PostgreSQL adapter and last-seat transaction rule with independent database connections, then rehearse a logical dump and restore into a new test database.

**Architecture:** A dedicated script accepts an explicitly named disposable database URL and creates two application pools against it. The script requires an empty database, checks five migrations, runs 100 concurrent contenders across the pools, and exits with JSON evidence. An isolated PostgreSQL 18.6 instance supplies the test backend; `pg_dump` and `pg_restore` rehearse logical recovery separately.

**Tech Stack:** TypeScript, `pg`, PostgreSQL 18.6 command-line tools, Node assertions.

**Spec:** `/Users/tsb/Downloads/01_PRD_v1.0.md` sections 15 and 26; `docs/superpowers/specs/2026-09-23-r1-functional-design.md`.

## Global Constraints

- Never run this verification against a nonempty database or an unapproved production URL.
- Use the existing `createProductionDatabase` adapter and domain commands rather than duplicating their SQL.
- Connect with at least two independent pools and 100 distinct contenders.
- A local test instance is stronger than PGlite evidence but does not replace managed production deployment verification.

## Review Focus

- Accidental connection to a populated or production database must stop before mutations.
- Concurrent startup migrations must record each version once.
- Final-seat contention must produce one confirmed and 99 waiting outcomes.
- Duplicate request keys must not allocate extra seats.
- Logical restore must preserve migrations and representative event/registration/audit rows.

---

### Task 1: Repeatable PostgreSQL integration script

**Files:** Create `scripts/verify-postgres.ts`; modify `tsconfig.json` only if needed.

- [x] Write a disposable-database guard that requires the database name to begin `irl_r1_test_`, checks that no application tables exist, and exits before `createProductionDatabase` on a populated database.
- [x] Start two `createProductionDatabase` pools concurrently and assert five migration records.
- [x] Use existing event and registration commands to seed host plus two participants, then submit 100 distinct join requests split between pools; assert one new confirmed seat, 99 waitlisted, and total capacity exactly four.
- [x] Repeat one idempotency key and assert the result refers to the same registration.
- [x] Run the script against the local test instance and capture the JSON result.

### Task 2: Logical recovery evidence

**Files:** Create `docs/evidence/postgres-integration-2026-09-24.md`; update `docs/acceptance-matrix.md` and `README.md`.

- [x] Use `pg_dump` custom format on the dedicated test database and `pg_restore` into a new empty database.
- [x] Compare migration checksums and event/registration/audit counts and content between source and restored databases.
- [x] Record exact software version, command scope, assertions, and remaining production deployment limits.
- [x] Run full tests, typecheck, diff check, request code review, and commit.
