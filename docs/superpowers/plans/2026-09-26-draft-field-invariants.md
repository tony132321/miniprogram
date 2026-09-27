# Draft Field Invariants Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Reject malformed values already supplied in a draft without requiring every publication field before saving.

**Architecture:** Reuse `EventInput`, `createDraft`, `updateDraft`, and `validatePublish` in `src/events.ts`. Add a partial-field validation step before either draft write, checking only present values and relationships whose operands are both present. Preserve publication's complete-field validation and version CAS.

**Tech Stack:** TypeScript, PGlite/PostgreSQL, native WeChat mini program.

**Spec:** v3.1 `engineering/tasks/T08.md` and `T09.md`, `AC-DRAFT-INVALID` and `AC-RQ03`; PRD RQ03.

## Global Constraints

- A draft with missing required fields remains saveable; a draft with explicitly invalid money, date, order, count, or field type is rejected by the server.
- On rejected update, the last valid stored draft and its version remain unchanged.
- Publication keeps validating all required fields and rejects corrupted legacy drafts.
- No visual UI redesign or second draft model.

## Review Focus

- `null`, arrays, objects, booleans and non-finite money passed as present fields must fail.
- Negative AA amounts, end before start, max below min and impossible dates must fail at save.
- A two-step draft remains saveable while valid partial fields are added.
- Rejected update must not change persisted payload or version.
- Legacy malformed payload must still fail at publish.

### Task 1: Draft save behavior

**Files:** `test/events.test.ts`, `test/api.test.ts`, `src/events.ts`.

- [x] Add a focused failing domain test for invalid create/update, preserved valid draft, and partial save.
- [x] Run focused test and confirm `Missing expected rejection` from absent save validation.
- [x] Implement partial-field validation before inserting or updating a draft.
- [x] Adapt existing publication tests so they continue proving complete validation using partial drafts and a deliberately corrupted legacy row.
- [x] Run focused domain and HTTP tests (31/31), typecheck and full tests (277/277); commit.

### Task 2: Evidence

**Files:** `docs/evidence/draft-field-invariants-v31-2026-09-26.md`, `docs/v3.1-package-integration-2026-09-25.md`.

- [x] Record exact executed tests and an authoritative HTTP readback after rejected update.
- [x] Identify remaining real-device and target-database gates without claiming publication readiness.
