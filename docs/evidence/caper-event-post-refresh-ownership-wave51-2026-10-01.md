# 活动写入后刷新与分享请求归属门控（2026-10-01）

## 范围

复核活动详情页的异步写入结果：预留席位、复刻草稿与准备分享卡。在原活动 A 请求已发出、页面转向活动或会话 B 时，迟到的 A 结果不得写入 B 的页面状态或触发 A 的导航。

## 先复现

新增 `test/miniprogram-event-post-refresh-race.test.ts`，通过真实页面 `action()` → `refresh()` 链路和可控的 API 读取，在刷新挂起时切换会话及页面。修复前 4/4 按预期失败：

- 活动 A 的预留结果覆盖活动 B 的 `reservationTokens`。
- 活动 A 的复刻结果让活动 B 页面导航到 A 的草稿。
- 活动 A 的分享请求失败覆盖 B 的提示，并清掉 B 的加载状态。
- 同一活动切换账号后，旧账号分享失败覆盖新账号的加载状态。

## 修复

- `action()` 只在后续刷新成功且仍属原操作人和活动时返回 POST 结果；失去归属时返回 `null`，因此 `reserve()` 不写入旧预留口令，`repeat()` 不打开旧草稿。
- `prepareShare()` 记录请求代次、身份、活动及原邀请版本。成功与失败提示仅由当前请求写入；`finally` 只清理仍属该请求的加载状态。
- 相邻导航测试的夹具明确设置当前测试身份 `host`，符合既有 `actionContext()` 的 READY 页面归属条件。

## 定向验证

命令：

```bash
/Users/tsb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --import tsx --test --test-concurrency=1 \
  test/miniprogram-event-post-refresh-race.test.ts \
  test/miniprogram-event-action-identity.test.ts \
  test/miniprogram-pg04s-published-shortcut.test.ts \
  test/miniprogram-event-screen-navigation.test.ts
```

结果：43/43 通过。`node --check miniprogram/pages/event/event.js` 与相关文件 `git diff --check` 通过。本次只覆盖上述活动详情页异步边界，未运行全量测试或真机验收。
