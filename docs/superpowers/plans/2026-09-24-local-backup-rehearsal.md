# Local PGlite Backup Rehearsal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Make a repeatable local backup and restore rehearsal that proves activity data and migration checksums survive recovery into a fresh directory.

**Architecture:** Use PGlite's `dumpDataDir('gzip')` while the local API is stopped. Restore the archive with `loadDataDir` into a new directory, then reopen through `createDatabase` so ordinary migration validation runs. Never overwrite an existing archive or target directory.

**Tech Stack:** TypeScript, Node.js file APIs, PGlite 0.5.8, Node test runner.

**Spec:** `/Users/tsb/Downloads/01_PRD_v1.0.md` sections 15 and 26; `docs/superpowers/specs/2026-09-23-r1-functional-design.md`.

## Global Constraints

- This is a local PGlite rehearsal, not production PostgreSQL backup evidence.
- The API must be stopped before opening its data directory for backup.
- Backup and restore must fail before modifying an existing output path.
- Recovery must verify normal migration checksums and representative business records.

## Review Focus

- Existing backup path: reject without overwriting it.
- Existing restore directory: reject without touching it.
- Corrupted archive: fail with no accepted restored database.
- Missing or stale migration: fail on normal database reopen.
- Shared business state: event, registration, and audit survive recovery.

---

### Task 1: Backup and restore tool

**Files:** Create `src/local-backup.ts`, `scripts/local-backup.ts`; test `test/local-backup.test.ts`.

**Interfaces:** `createLocalBackup(sourceDir, archivePath)` and `restoreLocalBackup(archivePath, destinationDir)` are asynchronous. The CLI accepts `backup <sourceDir> <archivePath>` or `restore <archivePath> <destinationDir>`.

- [x] Write a test that creates an event and registration in a persistent temporary database, backs it up, restores into a new directory, reopens with `createDatabase`, and compares event/registration/audit/migration rows.
- [x] Write tests rejecting existing output paths and a corrupted archive.
- [x] Run `pnpm exec tsx --test test/local-backup.test.ts` and observe failures.
- [x] Implement backup and restore with exclusive output creation, PGlite archive APIs, and cleanup of partial files/directories after errors.
- [x] Run the focused test, `pnpm test`, `pnpm typecheck`, and CLI syntax checks.

### Task 2: Evidence and operational instructions

**Files:** Modify `README.md`, `docs/acceptance-matrix.md`; create `docs/evidence/local-backup-2026-09-24.md`.

- [x] Document the stop, backup, restore, and verification commands and their local-only scope.
- [x] Execute the CLI against a disposable seeded PGlite directory and record source/restore counts and archive checksum.
- [x] Keep production PostgreSQL backup/restore as an explicit release blocker.
- [x] Review the diff and commit the verified change.
