# Failed Job Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make exhausted background jobs visible and recoverable by a specifically authorized operator without leaking job payloads or falsely reporting external delivery.

**Architecture:** Migration 17 adds a bounded error code to jobs. The worker records a category for each failed attempt and rejects unknown job kinds. A `JOBS` permission protects paged failed-job metadata and an idempotent, audited retry command. The operations page shows the queue and retry control; a retry only resets a failed job to pending, leaving execution to the existing worker and preserving notification reconciliation rules.

**Review follow-up:** Migration 18 adds per-claim worker tokens. Terminal writes require the current token, so an expired worker cannot overwrite a later claim or operator retry. Malformed JSONB payloads receive a controlled error category.

**Tech Stack:** TypeScript, Node HTTP, PostgreSQL/PGlite, plain browser JavaScript.

**Spec:** `docs/superpowers/specs/2026-09-23-r1-functional-design.md` section on failed tasks; PRD RQ12, RQ18 and section 20.

## Global Constraints

- Never return job payload, notification content, provider reference, recipient ID or raw exception messages in the queue.
- Retrying a job is not evidence that its effect or external notification succeeded.
- A job may only be retried from `FAILED`, with idempotency and a named operator audit record.
- Production configuration must assign `JOBS` to a named operator; existing independent appeal review still applies.
- Do not edit already applied migration SQL.

## Review Focus

- A malformed or unknown job reaches `FAILED` with a bounded error category after five attempts.
- 105 failed jobs remain reachable through pages; stale continuation is rejected.
- A retry requires `JOBS`, is idempotent, and leaves a single audit record.
- A nonfailed or missing job cannot be retried.
- A failed external send is not automatically claimed as delivered or blindly resent when provider status is uncertain.

---

### Task 1: Persist safe failure categories

**Files:** Create `src/migrations/0017_job_failure_codes.sql`; modify `src/db.ts`, `src/jobs.ts`; test `test/jobs-recovery.test.ts`, `test/db-migration.test.ts`.

- [x] Write failing tests for exhausted malformed and unknown jobs, failure code and migration count.
- [x] Run tests and confirm expected failures.
- [x] Add migration and worker categorization, clearing the code after success.
- [x] Run focused tests and typecheck.

### Task 2: Restricted queue and retry command

**Files:** Modify `src/operator-auth.ts`, `src/server.ts`, `src/main.ts`, `README.md`; create `src/job-recovery.ts`; test `test/jobs-recovery.test.ts`, `test/operator-permissions.test.ts`, `test/startup.test.ts`.

- [x] Write failing tests for 105-row queue, permission, malformed page, stale page, retry state, idempotency and audit.
- [x] Run tests and confirm expected failures.
- [x] Implement the `JOBS` permission, queue, retry command, HTTP routes and production startup requirement.
- [x] Run focused tests and typecheck.

### Task 3: Operations entry and verification

**Files:** Modify `operations/index.html`, `test/operator-ui.test.ts`, `docs/acceptance-matrix.md`; create `docs/evidence/failed-job-recovery-2026-09-25.md`.

- [x] Write failing UI tests for queue visibility, retry and stale pagination.
- [x] Run tests and confirm expected failures.
- [x] Add minimal failed-job section and recovery control.
- [x] Run focused tests, then full test suite, typecheck and diff check.
- [x] Record exact local evidence and external gaps.
