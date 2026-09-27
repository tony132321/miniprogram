# Production Operator Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an enrolled operator sign in to the existing workbench with a password and one-time code, while keeping operator sessions separate from member sessions.

**Architecture:** A single configured operator uses a scrypt password verifier and RFC 6238 TOTP. Login consumes a one-time counter atomically in PostgreSQL and issues a short-lived, hashed bearer session. All production `/ops/*` routes accept only that session. Missing enrollment fails closed.

**Tech Stack:** Node crypto, TypeScript, PostgreSQL/PGlite, existing HTTP server.

**Spec:** `/Users/tsb/Downloads/01_PRD_v1.0.md` section 20.3 (production security requirements); `docs/superpowers/specs/2026-09-23-r1-functional-design.md`.

## Global Constraints

- Keep existing operations workbench functional; do not redesign it.
- Production dev identity remains disabled.
- Rate limit login by source IP and account; reject one-time code replay.
- Operator sessions must never authorize member routes and member sessions must never authorize operations routes.
- Rotating either configured credential invalidates previously issued operator sessions.
- Production deployment still requires supplied secrets, HTTPS and operational enrollment.

## Review Focus

- Concurrent reuse of the same OTP must grant at most one session.
- A missing or malformed auth configuration must fail closed.
- Expired and revoked operator tokens must be rejected.
- Failed logout must not be reported as success, and pending refreshes cannot repopulate data after logout.
- Forged `X-Dev-User` and member bearer tokens must not reach operations data.
- Repeated guessing must produce a rate-limit response.

---

### Task 1: Credential and session core

**Files:** `test/operator-auth.test.ts`, `src/operator-auth.ts`, `src/migrations/0006_operator_auth.sql`, `src/db.ts`.

- [x] Write failing tests for password/TOTP login, replay and session expiry/revocation.
- [x] Run the targeted test and confirm the expected failure.
- [x] Implement only the credential and session behavior needed by the tests.
- [x] Run targeted tests and typecheck.

### Task 2: HTTP boundary and workbench

**Files:** `test/operator-api.test.ts`, `src/server.ts`, `src/main.ts`, `operations/index.html`.

- [x] Write failing HTTP tests for production login, route isolation and throttling.
- [x] Run the targeted test and confirm the expected failure.
- [x] Wire configured credentials to the server and add functional login/logout controls.
- [x] Run targeted and complete test suites.

### Task 3: Deployment record

**Files:** `README.md`, `docs/acceptance-matrix.md`, `scripts/verify-postgres.ts`, `test/db-migration.test.ts`.

- [x] Document provisioning, secret handling and remaining release blockers.
- [x] Run typecheck, tests and disposable PostgreSQL verification.
- [x] Review the diff and commit.
