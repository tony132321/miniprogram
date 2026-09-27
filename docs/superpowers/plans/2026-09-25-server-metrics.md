# R1 Server Metrics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce reviewable pilot metrics from server facts without mixing local test activities into production counts.

**Architecture:** The event record stores an immutable server-assigned test flag. A read-only metrics module evaluates published events, outcomes, check-ins and independent feedback at a stated `asOf` time, then exposes aggregate results only to a dedicated operations permission. Money metrics stay unavailable until actual revenue and cost inputs exist.

**Tech Stack:** TypeScript, PostgreSQL/PGlite, Node test runner, native HTTP operations API.

**Spec:** `docs/superpowers/specs/2026-09-23-r1-functional-design.md`; source definition: `/Users/tsb/Downloads/01_PRD_v1.0.md` section 21.

## Global Constraints

- Published activities and server records are the source of truth; frontend clicks cannot count as business success.
- Developer identities and existing unclassified records are test data. A client request cannot set or clear `is_test`.
- The event's first published minimum, not a later edited minimum, governs WQCA.
- Disputed or open safety cases are held for review, not counted as qualified successes.
- Do not infer revenue, payment completion, or direct cost from AA records.
- Keep raw member identities out of aggregate API responses.

## Review Focus

- A test event must remain excluded after repeat, even if it has otherwise complete evidence.
- An existing database migration must conservatively mark legacy events as test.
- A claimed outcome without enough individual check-ins must not qualify.
- A negative member feedback or unresolved report must suspend qualification.
- An immature 28-day host cohort must not enter the reuse denominator.

---

### Task 1: Immutable event test classification

**Files:** Create `src/migrations/0010_event_test_scope.sql`; modify `src/db.ts`, `src/events.ts`, `src/lifecycle.ts`, `src/server.ts`, `src/main.ts`, migration verifier/tests and README; test `test/metrics.test.ts`.

**Interfaces:** `createDraft(..., isTest?: boolean)` defaults to test; API assigns the value from runtime and configured verified pilot hosts, and `repeatEvent` inherits the source event's flag.

- [x] Write tests for migration default, development API, production API, forged client field, and repeat inheritance.
- [x] Run focused tests and observe the missing behavior.
- [x] Add migration and server-assigned flag without changing older migrations.
- [x] Run focused tests, full suite and typecheck; commit.

### Task 2: Evidence-backed WQCA

**Files:** Create `src/metrics.ts`; modify `test/metrics.test.ts`.

**Interfaces:** `getPilotMetrics(db, asOf)` returns week-level qualified, pending-review and unqualified counts, plus explicit reasons without personal identities. Weeks use activity `timeZone`; current published events require `Asia/Shanghai`.

- [x] Write tests for test exclusion, first-published minimum, valid attendance, absent/negative feedback, disputed outcome, open safety case, and local-week boundary.
- [x] Run focused tests and observe failures.
- [x] Implement read-only consistent-snapshot calculation from authoritative tables.
- [x] Run focused tests, full suite and typecheck; commit.

### Task 3: Mature host reuse and unavailable finance

**Files:** Modify `src/metrics.ts`, `test/metrics.test.ts`.

**Interfaces:** Add fully observed 28-day first-publish host cohorts and second-publish completion. Return contribution profit as `unavailable` with missing inputs, never a fabricated zero.

- [x] Write tests for immature cohorts, first and second publication boundaries, test exclusion, and no financial inference from AA records.
- [x] Run focused tests and observe failures.
- [x] Implement the calculations and rerun tests, typecheck and PostgreSQL integration; commit.

### Task 4: Restricted operations evidence

**Files:** Modify `src/operator-auth.ts`, `src/server.ts`, `operations/**`, `test/operator-permissions.test.ts`, `README.md`, `docs/acceptance-matrix.md`; create evidence document.

**Interfaces:** `GET /ops/metrics` requires `METRICS` permission and returns aggregate metrics only. The workbench shows sample maturity and missing data sources.

- [x] Write denied-access and aggregate-only HTTP tests.
- [x] Run them red; implement permission, route and minimal existing-style workbench section.
- [x] Verify full suite, typecheck, served operations page and real local PostgreSQL; document limits; commit.
