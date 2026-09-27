# PG08 attendance read states

The activity page previously converted failed `/manual-checkins` and `/checkins` reads into empty lists. That could hide existing attendance evidence or an outstanding manual confirmation. The existing refresh now reads both together and shows an explicit `ERROR` or `FORBIDDEN` state when either cannot be read. It clears any older attendance rows until a complete new read succeeds, shows a verified empty state only when both reads succeed with no rows, and uses the existing refresh action to retry.

The page-level regression test failed against the old behavior, then passed for scan-read failure, manual-read failure, recovery to an empty response, and forbidden access. In WeChat Developer Tools `0.3.11`, an isolated local proxy made only the check-in GET return 503 while the rest of the event detail loaded. The simulator showed [the error and retry action](wechat-attendance-retry-error-2026-09-26.jpg). After restoring the GET, an actual tap on `#attendanceRetryButton` changed runtime `attendanceLoadState` from `ERROR` to `EMPTY` and showed [the verified empty state](wechat-attendance-retry-empty-2026-09-26.jpg). The test servers were stopped and the temporary proxy removed.

Full `pnpm test` passed 316/316; `pnpm typecheck`, `git diff --check`, and the WeChat Developer Tools WXML compiler passed.

This covers local read recovery. Real-device offline behavior, camera scanning, and human attendance evidence remain unverified.
