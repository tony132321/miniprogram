# Public gate notices implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create reliable in-app notices for people affected when safety operators close or reopen public recruitment.

**Architecture:** The gate transaction snapshots active public event hosts and registered people into durable jobs without taking event foreign-key locks. The existing worker materializes each job into one in-app notice with the job ID as notification ID, so a crash/retry cannot duplicate it. No external delivery is claimed without a configured WeChat template.

**Tech Stack:** TypeScript, PostgreSQL/PGlite, existing jobs and notifications tables.

**Spec:** `/Users/tsb/Downloads/01_PRD_v1.0.md` §16.2–16.3, `docs/superpowers/specs/2026-09-23-r1-functional-design.md`.

## Global Constraints

- The gate must close promptly and cannot wait for a provider or event row lock.
- Recipients cannot see the operator's private investigation reason.
- Replaying a gate command or a worker job must not create duplicate notices.
- Existing in-app notices remain readable without external notification consent.

## Review Focus

- A host who is not registered still gets the notice.
- Invite-only and draft events get no public gate notice.
- Previously cancelled and removed users get no new notice.
- A retry after a notice is inserted cannot duplicate it.
- A pending close notice remains durable if the worker is offline.

---

### Task 1: Snapshot recipients when the gate changes

**Files:** Modify `src/public-gate.ts`, `test/public-gate.test.ts`.

**Interfaces:** Insert one `PUBLIC_GATE_NOTICE` job with `event_id=NULL` for each distinct `(eventId,userId)` recipient; payload carries `eventId`, `userId`, `eventVersion`, `status`. The job ID is the future notification ID.

- [x] Write tests asserting pending jobs for recruiting public event hosts and current registrants, absent jobs for pending/private/draft/cancelled recipients, and idempotent replay.
- [x] Run targeted tests and observe missing jobs.
- [x] Insert recipient jobs within the gate transaction after changing status using one set based SQL statement.
- [x] Run targeted tests until green.

### Task 2: Materialize notices safely

**Files:** Modify `src/jobs.ts`, `test/public-gate.test.ts`, `miniprogram/pages/me/me.wxml`, evidence docs.

**Interfaces:** `runDueJobs` creates a notice with kind `PUBLIC_RECRUITMENT_CLOSED` or `PUBLIC_RECRUITMENT_OPEN`, `id=job.id`, `external_status='UNAVAILABLE'`, and detail containing only the gate status.

- [x] Write tests for one notice per recipient, no private reason, retry, and close/reopen ordering.
- [x] Run tests and observe no notices and incorrect delayed ordering.
- [x] Add worker branch and plain-language notice labels in the existing page.
- [x] Run full tests, typecheck, production PostgreSQL verification and simulator flow; review and commit.
