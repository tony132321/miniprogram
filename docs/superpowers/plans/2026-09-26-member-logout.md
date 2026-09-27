# Member Logout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** A member can leave the current WeChat session from the profile page and return to an unauthenticated safe entry without retaining private page data.

**Architecture:** Add a bearer-only logout endpoint that deletes the current session hash in a transaction and audits the action. The mini-program API calls it before removing locally stored credentials; the profile page clears private data and switches to the activity-list tab. Network failure keeps the session so the action can be retried honestly.

**Tech Stack:** TypeScript HTTP server, PGlite/PostgreSQL, WeChat mini-program JavaScript, node:test.

**Spec:** `Project_IRL_Autonomous_Engineering_Package_v3.1/engineering/tasks/T27.md`, especially AC-PG10 and AC-UI-PG10.

## Global Constraints

- Reuse the existing bearer session table and identity-clearing behavior.
- Development identity is not an official session and cannot revoke one without a bearer token.
- No new UI layout or visual design.

## Review Focus

- The revoked bearer can no longer read private endpoints, while another session remains valid.
- A forged or missing bearer cannot revoke a session.
- The profile page clears prior private data before navigation on success, including responses in flight.
- A failed logout does not claim success or navigate.
- Returning to the activity list exposes a login retry path.

---

### Task 1: Server session revocation

**Files:** Modify `src/auth.ts`, `src/server.ts`; test `test/api.test.ts`.

- [x] Add an HTTP integration test and observe it fail against the missing endpoint.
- [x] Revoke only the presented valid bearer token and write an audit record.
- [x] Verify old bearer rejection and independent session validity.

### Task 2: Mini-program logout path

**Files:** Modify `miniprogram/utils/api.js`, `miniprogram/pages/me/me.js`, `miniprogram/pages/me/me.wxml`; test `test/miniprogram.test.ts`.

- [x] Add failing API and profile tests for success and network failure.
- [x] Add the existing-page logout button and safe navigation.
- [x] Run focused and full tests, typecheck, PostgreSQL verification and WeChat Developer Tools simulation.
- [x] Record evidence, including delayed login and export regression tests.
