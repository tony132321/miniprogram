# Public recruitment shutdown implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let safety operators stop and restore all new public recruitment quickly, with durable state and audit evidence.

**Architecture:** A singleton PostgreSQL gate stores OPEN/CLOSED and the operator's reason. Public recruitment transitions take a shared row lock, while gate changes take an exclusive lock, so a completed close cannot race a new seat. Existing participants retain read and exit access; private invite activities remain usable.

**Tech Stack:** TypeScript, Node HTTP, PostgreSQL/PGlite, WeChat mini-program client.

**Spec:** `docs/superpowers/specs/2026-09-23-r1-functional-design.md` and `/Users/tsb/Downloads/01_PRD_v1.0.md` §16.3 and release gate P0.

## Global Constraints

- Do not redesign the UI. Add only the operational control needed to expose the gate.
- PUBLIC activities still need manual review after reopening.
- Preserve existing participants' view, cancellation, check-in, reporting, and appeal paths.

## Review Focus

- Duplicate close or reopen requests must replay without extra audit records.
- Non-safety operators cannot read or mutate the gate.
- Existing waitlist offers and reservations cannot turn into seats while closed.
- Closing must not stop invite-only enrollment or exits from public events.
- A new public approval or publish cannot make recruitment available during a close.

---

### Task 1: Durable gate and operator route

**Files:** Create `src/migrations/0008_public_recruitment_gate.sql`, `src/public-gate.ts`, `test/public-gate.test.ts`; modify `src/db.ts`, `src/server.ts`, migration count checks.

**Interfaces:** `getPublicGate(db)`, `setPublicGate(db, actor, status, reason, key)`, `assertPublicRecruitmentOpen(tx, visibility)`. Operators use GET and POST `/ops/public-recruitment` with `SAFETY` permission.

- [x] Write tests for initial OPEN, close, replay, bad reason, authorization, and reopen.
- [x] Run `tsx --test test/public-gate.test.ts` and observe the expected failure.
- [x] Add migration, transaction helper, and HTTP routes.
- [x] Run targeted tests until green; commit with the remaining task after integration.

### Task 2: Enforce closure across public entry paths

**Files:** Modify `src/events.ts`, `src/event-review.ts`, `src/registrations.ts`, `src/lifecycle.ts`, `src/server.ts`; extend `test/public-gate.test.ts`.

**Interfaces:** The gate returns `PUBLIC_RECRUITMENT_PAUSED` (409) for writes and hides public invite summaries while CLOSED.

- [x] Write tests for publication, approval, applications, reservation, reservation claim, host approval, confirmation, outsider read, public invite, private invite, public exit, and sharing. Inspect the existing offer path and its shared gate assertion.
- [x] Run targeted tests and observe the missing gate and sharing failures.
- [x] Add gate checks to every new public recruitment transition and public discovery surface.
- [x] Run targeted tests until green.

### Task 3: Operator control and release evidence

**Files:** Modify `operations/index.html`, `docs/acceptance-matrix.md`, `scripts/verify-postgres.ts`; create `docs/evidence/public-shutdown-2026-09-24.md`.

**Interfaces:** The workbench displays current gate state and a reason field for close and reopen.

- [x] Add a test for the operator route and update the workbench control.
- [x] Run typecheck, full test suite, production PostgreSQL verification, and local HTTP smoke tests.
- [x] Document observed results and unavailable real-device/release prerequisites.
- [x] Review the diff, resolve findings, and commit.
