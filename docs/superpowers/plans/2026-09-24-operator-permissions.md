# Operator Permission Boundaries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restrict each production operator account to its assigned workbench functions while keeping existing development and single-account flows usable.

**Architecture:** Assign explicit permissions per named account in `OPS_ACCOUNTS_JSON`: `REPORTS`, `SAFETY`, `EVENT_REVIEWS`, `APPEALS`, `PRIVACY`, `CONTENT`, `RATE_LIMITS`. Check the permission on every corresponding `/ops/*` route in the server before reading or mutating data. New named-account lists require at least one permission; legacy single-account configuration keeps full access during migration. The workbench treats 403 lists as unavailable while showing allowed lists.

**Tech Stack:** TypeScript, existing HTTP server, HTML/JavaScript workbench, PGlite/PostgreSQL.

**Spec:** `/Users/tsb/Downloads/01_PRD_v1.0.md` sections 3.1, 20.3 and 24.2; `docs/acceptance-matrix.md` RQ18. [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) supports explicit least privilege and default denial.

## Global Constraints

- The server enforces permissions; client hiding never authorizes an action.
- Named accounts fail startup when permissions are absent, empty, duplicated or unknown.
- Changing permissions invalidates an existing session at the next request after configuration reload.
- Development `OPERATIONS_USERS` and the legacy single-account variables remain compatible for local workflow migration.
- This feature does not claim an actual staffing roster or independent review of high-risk sanctions.

## Permission Matrix

| Permission | Reads | Mutations |
| --- | --- | --- |
| `REPORTS` | `/ops/reports` | `/ops/reports/:id/status` |
| `SAFETY` | `/ops/holds` | `/ops/events/:id/hold`, `/ops/holds/:id/release` |
| `EVENT_REVIEWS` | `/ops/events/reviews` | `/ops/events/:id/review` |
| `APPEALS` | `/ops/appeals` | `/ops/appeals/:id/status` |
| `PRIVACY` | `/ops/privacy` | None in R1 |
| `CONTENT` | `/ops/content` | `/ops/content/:id/moderate` |
| `RATE_LIMITS` | `/ops/rate-limits` | None |

## Review Focus

- Every operator route, including mutations, has one matching server check.
- Sensitive reports and privacy records are not returned to unrelated roles.
- Removed permissions invalidate old tokens; adding a permission requires login with the new configuration.
- Missing permissions fail startup for named accounts, and future routes fail closed.
- The workbench still displays allowed queues when others return 403.

---

### Task 1: Configuration policy

**Files:** `src/operator-auth.ts`, `test/operator-auth.test.ts`.

- [x] Write failing tests for required/unknown permissions and session invalidation on scope change.
- [x] Confirm the expected failures.
- [x] Implement validation and credential fingerprint binding.
- [x] Run targeted tests and typecheck.

### Task 2: Server permission matrix

**Files:** `src/server.ts`, `test/operator-api.test.ts`.

- [x] Write failing HTTP tests for allowed reads/mutations and forbidden cross-role requests.
- [x] Confirm the expected failures.
- [x] Enforce permission checks on every `/ops/*` data route.
- [x] Run targeted and complete tests.

### Task 3: Workbench and evidence

**Files:** `operations/index.html`, `test/operator-ui.test.ts`, `README.md`, `docs/acceptance-matrix.md`.

- [x] Write failing workbench test for mixed 200/403 queue responses.
- [x] Keep allowed queues usable and explain denied queues.
- [x] Update configuration and scope evidence; verify typecheck and tests.
- [x] Commit the change.
