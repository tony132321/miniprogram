# Waitlist offer dispatch respects risk gates

The member notification list already marked a waitlist offer nonactionable during an event safety hold or a public recruitment closure. External dispatch checked the emergency gate and offer validity, but omitted those two gates. A queued offer could therefore be pushed to a provider even though the member could not accept it.

Two integration regressions failed before the fix: both the held event and the closed public recruitment gate allowed one external adapter call. The public scenario uses an explicitly seeded persisted waitlist row after manual approval, representing a queued legacy record; current public events use manual approval and do not generate that row through the normal application path. The dispatch transaction now reads active holds and the public gate with share locks before the provider call. Ineligible offers become `STALE_STATE`. A separate positive test confirms that a public-only closure leaves a private invitation event's offer eligible.

Verification on 2026-09-26:

- Focused notification suite: 14/14 passed; the two negative regressions failed before the fix.
- Full `pnpm test`: 292/292 passed.
- `pnpm typecheck` and `git diff --check`: passed.

No real subscription provider was contacted. The adapter is a test double, so this proves server dispatch decisions and stored status, not real delivery or true device behavior. The mini program's existing actionable-state UI was not changed in this task.
