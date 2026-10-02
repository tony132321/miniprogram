# 本人活动列表分页与账号隔离（2026-09-30）

## 改动

- `/me/events` 在显式传入 `limit`、`offset` 或 `snapshot` 时返回最多 100 条记录、总数、下一页位置和当前账号可见列表的快照标识；无分页参数时保留旧版 `{items}` 响应。
- 翻页使用服务端同一事务中的可见投影生成快照。账号不同或列表在两次请求之间变化时返回 `409 QUEUE_CHANGED`；客户端从第一页重试，最多 2 次。客户端在每页前后核对当前账号，防止账号切换后混入旧数据。
- 现有五个小程序调用点继续通过 `api.get('/me/events')` 获取完整列表，不需各页重复实现翻页；异常的空继续页会立即失败，不会无限请求。

## 验证

- `node --import tsx --test --test-isolation=none --test-concurrency=1 test/me-events-summary.test.ts test/miniprogram-me-events-pagination.test.ts test/miniprogram.test.ts`：**97/97** 通过。
- `pnpm typecheck`、`git diff --check`：通过。

## 边界

本次限制单次 HTTP 响应大小，并保证翻页期间的账号和列表一致性。服务端每页仍会读取并排序该账号的完整活动集，客户端也会继续取齐全部页面，因此大规模账号的数据库开销和首屏延迟尚未消除。此处仅为本地合成契约验证；新的分页请求尚未在微信开发者工具真实点击中复测，正式环境和大规模性能亦未验收。
