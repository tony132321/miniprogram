# R1 Direct Support Minutes Plan

**Goal:** Let authorized operators record direct work minutes against a pilot activity, preserving who entered each fact and keeping missing time data distinct from zero.

**Source:** PRD section 21.2 requires per-activity direct human minutes as a guardrail; section 21.1 requires direct support cost for contribution profit. The current metric has no actual time or cost source.

**Design:** Store immutable, idempotent operator attestations in PostgreSQL. Each entry has an activity, operator identity, category, integer minutes (including explicit zero), and server timestamp. One operator may submit multiple entries, each with a unique idempotency key. There is no editing or deletion in this increment; erroneous entries need a later correction operation and must not be silently overwritten. A dedicated `SUPPORT_MINUTES` permission controls entry and recent history; `METRICS` stays read-only. The restricted metrics API returns only aggregate recorded minutes and entry count for allowlisted, non-test activities. It labels coverage as incomplete because activity-level records cannot prove that every operator reported all time. No currency conversion or profit claim is made.

## Tasks

- [x] Add migration 11 and domain function with validated activity, integer minutes, category, idempotency, operator-only identity and immutable audit row. Test transaction rollback and duplicate replay.
- [x] Add `SUPPORT_MINUTES`-protected HTTP entry and recent history, plus `METRICS`-protected aggregate report, with tests for denied writes, malformed input and excluding test/unlisted activities.
- [x] Show a simple entry form and recorded totals in the existing operations page; verify DOM-script behavior and retry key preservation.
- [x] Run full tests, typecheck, fresh real PostgreSQL integration, update evidence and acceptance matrix, request code review, and commit.

## Boundaries

- An absent entry means **unrecorded**, not zero minutes. A zero-minute entry is an explicit attestation from one operator.
- Recorded minutes are a partial operational measure, not a complete cost or coordination-time estimate. The profit metric stays `UNAVAILABLE`.
- Client-supplied actor, activity test flag, timestamp and financial amount are ignored or rejected; server identity and event classification are authoritative.
