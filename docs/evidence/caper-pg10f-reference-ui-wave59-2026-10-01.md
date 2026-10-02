# Task 2 — PG10-F reference fidelity / Wave 59

Status: implementation complete; compiled simulator UI verification delegated to root.

## Owned changes

- `miniprogram/subpackages/profile/cache/cache.wxml`: separates real main reading into numeric text and MB unit; unavailable state keeps `--` and omits unit. Replaces literal person/storage/device/data/shield symbols with page-owned outline shapes and adds refresh icon. All button bindings and closed capability copy preserved.
- `cache.js`: adds `storageSizeNumber` derived once from the native KB reading, retaining compatible `storageSize` and `storageLimit` formatted fields. Initial/failure states clear the new field. Native reads, validation, actual timestamp, percentage, privacy focus and routes unchanged.
- `cache.wxss`: at 375px, 1px = 2rpx. Main reading 56/72rpx = 28/36px; MB 26/32rpx = 13/16px; heading 34/44rpx = 17/22px; bar 24rpx = 12px; info icon frames 80rpx = 40px; CTA 96rpx = 48px; avatar 64rpx = 32px. Page and summary padding 32rpx = 16px; info cards 24rpx = 12px. Metrics labels 11/14px and values 15/20px; body copy 13/18px. Own header title also 17/22px.

## Existing focused checks

Command (bundled Node directory prepended to PATH):
`node --import tsx --test --test-isolation=none --test-concurrency=1 test/pg10-legal-cache.test.ts test/miniprogram-pg10f-storage-read-status.test.ts`

Result: 6 tests passed, 0 failed. Includes native 512KB -> 0.50 MB / 10.00 MB / 5%, invalid statistics unavailable, refresh timestamps changing with reads, zero storage clearing writes, real privacy focus to `/pages/me/me`. Legal companion checks passed because existing cache tests share the file.

`node --check miniprogram/subpackages/profile/cache/cache.js`: exit 0.
`git diff --check -- miniprogram/subpackages/profile/cache`: exit 0.

## Remaining evidence / concerns

No simulator or physical device controlled; no screenshot, compiled WXML or final pixel claim. Root should inspect native capsule spacing with 32px avatar, main summary wrapping at narrow widths and full-page scroll with enlarged body text. Main real numbers can be much larger than reference mock values; the summary title is allowed to wrap rather than clip the numeric reading. Outline icons use local WXSS geometry with pseudo-elements, no remote fonts or external bitmap assets. This restores semantic silhouette and size rather than asserting exact Material glyph path identity. No fake cleanup categories, cleanup guarantees, destructive action or fabricated timestamp introduced. No full suite, commits or push performed.

## 根代理整合补验

后续修正、最终定向结果、CLI 包体及模拟器实点见 [Wave 59 整合证据](caper-wave59-focused-devtools-2026-10-01.md)。本报告的实现阶段结果保留，整合结果以该证据为准。
