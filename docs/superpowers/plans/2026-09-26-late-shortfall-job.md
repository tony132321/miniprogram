# Late Shortfall Job Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Prevent a delayed registration-deadline job from rewriting an already started activity as normally cancelled.

**Architecture:** Reuse the current durable `REGISTRATION_DEADLINE` job, event row lock, audit, and `formationRisk` projection. Pass the worker's current time into the shortfall handler. Before changing event status, compare it with the activity start; if the job is late, record a distinct audit fact and leave status/registrations/notifications unchanged.

**Tech Stack:** TypeScript, PGlite/PostgreSQL, durable worker.

**Spec:** v3.1 `engineering/tasks/T19.md` `AC-FORMATION-RISK`, `T20.md` `AC-CHANGE-AFTER-START`, PRD RQ09/RQ10.

## Global Constraints

- Before start, the existing shortfall cancellation and durable notice continue.
- After start, the worker must not create a normal cancellation or overwrite attendance history; the database checks its current time again at the status write.
- A delayed job finishes once and leaves an auditable fact; current low-count risk remains visible to the host.
- No new external notification/provider dependency.

## Review Focus

- Boundary exactly at start counts as late.
- A replayed late job makes no duplicate audit row.
- A worker timestamp captured before start cannot authorize a cancellation when the actual database write occurs after start.
- An event already cancelled/completed is unchanged.
- A future-start shortfall still cancels as before.

### Task 1: Worker boundary

**Files:** `test/lifecycle.test.ts`, `src/jobs.ts`.

- [x] Add a failing delayed-job test using the worker's injected time after activity start.
- [x] Run the focused test red and confirm status becomes `CANCELLED` unexpectedly.
- [x] Add an under-lock start-time guard and distinct audit action.
- [x] Run focused (41/41) and full tests (282/282), typecheck, then commit.

### Task 2: Evidence

**Files:** `docs/evidence/late-shortfall-job-v31-2026-09-26.md`, `docs/v3.1-package-integration-2026-09-25.md`.

- [x] Record the before-start and late-job outcomes with exact test results.
- [x] Note real worker scheduling and on-site incident handling remain separate gates.
