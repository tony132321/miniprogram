# Individual Operator Accounts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let multiple named operators use separate MFA credentials, preserve individual audit identity, and revoke a removed operator's sessions.

**Architecture:** Keep the existing password, TOTP and session tables. Load a validated list of operator credentials from a deployment secret, select one credential by username at login, and resolve every operator session against the current list and credential fingerprint. Keep the existing single-account variables as a temporary compatibility path, but reject mixing them with the list.

**Tech Stack:** TypeScript, Node crypto, PostgreSQL/PGlite, existing HTTP server.

**Spec:** `/Users/tsb/Downloads/01_PRD_v1.0.md` sections 20.3 and 24.2; `docs/acceptance-matrix.md` RQ18.

## Global Constraints

- Do not change the user-facing mini-program or redesign the operations workbench.
- Missing operator configuration stays closed in production.
- Duplicate usernames, decoded TOTP keys and noncanonical Base32 seeds fail startup validation.
- Individual operator audit IDs survive on report and safety operations.
- Removing an account or rotating its credentials invalidates its old sessions after configuration reload.
- This does not assert that real staff enrollment or a duty roster exists.

## Review Focus

- Unknown usernames must not reveal which configured account exists by a distinct success path.
- A removed operator cannot use a token issued before restart.
- One operator's TOTP use cannot consume another operator's counter.
- Malformed or duplicate secret configuration must fail startup.
- Single-account deployments must still work during migration.

---

### Task 1: Credential list and session lookup

**Files:** `src/operator-auth.ts`, `test/operator-auth.test.ts`.

- [x] Write failing tests for duplicate credentials, two named accounts and removed-account revocation.
- [x] Confirm the expected failures.
- [x] Implement validated credential-list and session lookup behavior.
- [x] Run targeted tests and typecheck.

### Task 2: Server configuration and identity evidence

**Files:** `src/server.ts`, `src/main.ts`, `test/operator-api.test.ts`.

- [x] Write failing HTTP tests for two logins, distinct audit actors and missing-account failure.
- [x] Confirm the expected failures.
- [x] Wire `OPS_ACCOUNTS_JSON` with compatibility for current single-account variables.
- [x] Run the complete test suite.

### Task 3: Deployment notes and review

**Files:** `README.md`, `docs/acceptance-matrix.md`, `docs/evidence/operator-auth-2026-09-24.md`.

- [x] Document account provisioning, rotation and remaining staffing limits.
- [x] Verify full tests, typecheck, PostgreSQL script and reviewed diff.
- [x] Commit reviewed changes.
