# 发现页首屏顺序窄修（Wave 27，2026-10-01）

## 依据与范围

- 设计来源：`/Users/tsb/Downloads/stitch_design_system_generator (2).zip` 中的 `stitch_design_system_generator/caper_4/screen.png` 和 `code.html`。原稿的分类条后立即是双列摄影卡（`FilterCategories` 后接 `FeaturedEventsGrid`）。
- 本次仅调整发现页首屏元素顺序：分类条 → 双列摄影灵感卡 → 公开找局提示条及按需显示的分类反馈 → 后续推荐区。没有将摄影灵感卡伪装成已开放的公开活动。
- 原有 `jumpToInvite` 仍指向真实的 `#inviteEntry` 邀请口令区；口令、扫码、卡片灵感说明和相关导航处理函数没有变更。

## 核验

- `node --import tsx --test --test-isolation=none --test-concurrency=1 test/miniprogram-discover-actions.test.ts test/miniprogram-discover-inspiration.test.ts test/miniprogram-discover-invite-focus.test.ts test/miniprogram-discover-personal-events.test.ts`：11/11 通过。
- `node node_modules/typescript/bin/tsc --noEmit`：通过。
- `git diff --check`：通过。

本记录是设计原稿与代码顺序、现有行为测试的证据；本批没有操作微信开发者工具或取得新模拟器截图，仍需在最终整合版本复核视觉位置和按钮点击。
