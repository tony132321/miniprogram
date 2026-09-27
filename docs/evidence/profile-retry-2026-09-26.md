# PG10 profile retry after network failure

The existing profile `refresh()` requests nine private resources together. On a network failure it previously showed an error message with no page action to retry. The page now records `LOADING`, `READY`, `ERROR`, and `UNAUTHENTICATED` load states and shows “重新加载” only after a failed load. The button invokes the same `refresh()` method; no second data path or layout was introduced.

The new mini-program test first failed because `loadState` was absent, then passed with an offline response followed by live data. In WeChat Developer Tools `0.3.11`, an isolated local PGlite API was stopped while the profile was open. The simulator showed the network error and [retry button](wechat-profile-retry-offline-2026-09-26.jpg). After restarting the same API, an actual tap on `#profileRetryButton` changed runtime `loadState` from `ERROR` to `READY` and cleared the error message. The API was stopped after the check.

Final verification: `pnpm test` 312/312 passed, `pnpm typecheck` and `git diff --check` passed, and WeChat Developer Tools compiled `pages/me/me.wxml` successfully.

This verifies the local simulator recovery path. It does not establish real-device network behavior.
