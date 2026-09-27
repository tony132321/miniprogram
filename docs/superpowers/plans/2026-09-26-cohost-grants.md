# Cohost Grants Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Add per-event, per-capability cohost grants that a host can revoke immediately, while preserving the cohost's own participation rights.

**Architecture:** Reuse events, sessions, transactional commands and audit. A new grant table stores one active capability set per event and user with expiry and revocation. Server actions check the current row inside their existing event transaction; list/read endpoints use the same scope. The current event page gains small host grant/revoke and cohost action controls without visual redesign.

**Tech Stack:** TypeScript, PostgreSQL/PGlite, native WeChat mini program.

**Spec:** `Project_IRL_Autonomous_Engineering_Package_v3.1/engineering/tasks/T07.md`, PRD section 3.1 and `specs/openapi.json` cohost routes.

## Global Constraints

- Scope is one event and one or more of `APPROVE_REGISTRATION`, `MANAGE_ANNOUNCEMENTS`, `CHECKIN_MANAGE`.
- Only host grants and revokes; no grant transfers host-only event, expense or completion powers.
- Execute authorization from current database state, including expiry and revocation, on every privileged operation.
- Keep other member rights independent of cohost status; avoid private invite token exposure.
- Reuse existing idempotency and audit mechanisms; preserve existing migrations.

## Review Focus

- Old bearer session after revocation must fail immediately.
- A grant for activity A must never authorize activity B.
- A check-in-only grant must not approve registrations or manage announcements.
- A cohost who is also a confirmed participant must retain self check-in and exit after revocation.
- Concurrent revocation and action must be ordered by the event transaction lock.

### Task 1: Durable grant contract

**Files:** `src/migrations/0026_cohost_grants.sql`, `src/db.ts`, `src/cohosts.ts`, `test/cohosts.test.ts`.

- [x] Write failing tests for host grant/revoke, capability isolation, expiry, idempotency and audit.
- [x] Run the focused test and confirm the missing behavior (`NOT_IMPLEMENTED`).
- [x] Add migration 26 and transactional grant/revoke helpers plus read-only capability check.
- [x] Run focused tests and migration tests (6/6), full tests (270/270) and typecheck; commit.

### Task 2: Enforce cohost actions

**Files:** `src/server.ts`, `src/registrations.ts`, `src/lifecycle.ts`, `src/collaboration.ts`, `src/events.ts`, `test/cohosts.test.ts`.

- [x] Write HTTP and domain tests for allowed action, denied sibling action, cross-event and revoked session.
- [x] Run tests red (grant route returned 404).
- [x] Add scoped routes and authorization checks under existing event locks.
- [x] Run full tests (273/273), typecheck and commit.

### Task 3: Existing page workflow

**Files:** `miniprogram/pages/event/event.js`, `miniprogram/pages/event/event.wxml`, `test/miniprogram.test.ts`, evidence.

- [x] Test host grant/revoke and cohost action state from current API data, including loading/error paths.
- [x] Add minimal controls to the existing event page.
- [x] Run full tests (275/275), typecheck and WeChat developer tools simulator grant/revoke; record actual evidence and commit.
