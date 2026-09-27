# Explicit Host Participation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Require the host to explicitly decide whether they take one seat before publication.

**Architecture:** Keep the existing `hostParticipates` payload and server publication validation. Change only the existing creation page's initial/empty-draft state to undecided, provide a two-choice control, and omit the field while undecided. The server already requires a boolean at publication and only creates a host registration when true.

**Tech Stack:** Native WeChat mini program, TypeScript server, PGlite tests.

**Spec:** v3.1 `engineering/tasks/T09.md` `AC-DRAFT-HOST-COUNT`; PRD RQ03, RQ09.

## Global Constraints

- Saving a partial draft remains possible before choosing; publication requires true or false.
- AI total-person extraction cannot imply the host's choice.
- Existing published events keep their stored choice when edited.
- False means no host registration and no hidden extra participant.

## Review Focus

- Fresh form has no inferred choice and cannot preview a publishable event.
- Explicit yes/no survives saving and reloading a draft.
- A host choosing no is absent from confirmed count; choosing yes is present exactly once.
- Reset after editing a published activity returns to undecided.
- The selector remains operable in the WeChat simulator.

### Task 1: Test and implement explicit choice

**Files:** `test/miniprogram.test.ts`, `test/events.test.ts`, `miniprogram/pages/create/create.js`, `miniprogram/pages/create/create.wxml`.

- [x] Add mini program and server tests for undecided, yes, no and saved draft reload.
- [x] Run focused mini program test red (`true !== null`); server refusal already passed.
- [x] Replace the default switch with explicit yes/no choice and omit undecided from draft payload.
- [x] Run focused tests (56/56), typecheck, full tests, simulator and commit.

### Task 2: Evidence

**Files:** `docs/evidence/host-participation-v31-2026-09-26.md`, `docs/v3.1-package-integration-2026-09-25.md`.

- [x] Record simulator action, actual page state and server count evidence.
- [x] State formal account and real-device limits.
