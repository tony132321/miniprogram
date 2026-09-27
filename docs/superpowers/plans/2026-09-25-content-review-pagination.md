# Content Review Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every pending question, answer and announcement reachable by the content moderation operator.

**Architecture:** Add 100-row pages with a repeatable-read queue snapshot to the existing restricted endpoint. The workbench shows the total, appends pages, and restarts after queue changes.

**Tech Stack:** TypeScript, Node HTTP, PostgreSQL/PGlite, plain browser JavaScript.

**Spec:** `docs/superpowers/specs/2026-09-23-r1-functional-design.md`; PRD RQ11 and RQ19.

## Global Constraints

- Preserve `CONTENT` permission on listing and moderation.
- Pending content remains invisible to other members until reviewed.
- A changed or handled item must invalidate an old continuation snapshot.
- Keep the operations page functional and visually minimal.

## Review Focus

- 105 pending items: all can be reached without duplicates.
- Decision or new content between pages: reject stale continuation.
- Bad page parameters: return 400.
- Network failure: retain the retry offset.
- No content permission: return no rows or total.

---

### Task 1: Page the restricted content API

**Files:** Modify `src/collaboration.ts`, `src/server.ts`; test `test/collaboration.test.ts` or `test/api.test.ts`; adapt direct callers.

**Interfaces:** `listPendingContent(db, offset, snapshot)` returns `{items,total,nextOffset,snapshot}`. GET `/ops/content?offset=N&snapshot=HASH`.

- [x] Add failing tests for 105 items, two pages, invalid continuation and stale snapshot.
- [x] Run the focused tests to confirm expected failure.
- [x] Implement validated parameters and a repeatable-read queue snapshot.
- [x] Run focused tests and typecheck.

### Task 2: Expose later content in workbench

**Files:** Modify `operations/index.html`; test `test/operator-ui.test.ts`.

- [x] Add failing tests for total, append, stale refresh and retry.
- [x] Run the focused tests to confirm expected failure.
- [x] Add a load-more control and page state with generation checks.
- [x] Run focused tests and typecheck.

### Task 3: Verify and record

**Files:** Update `docs/acceptance-matrix.md` and `docs/evidence/`.

- [x] Run full `pnpm test`, `pnpm typecheck` and `git diff --check`.
- [x] Record local evidence and remaining WeChat and human moderation gaps.
- [x] Commit the verified work.
