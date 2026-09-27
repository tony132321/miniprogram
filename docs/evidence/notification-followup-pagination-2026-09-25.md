# 运营通知待跟进分页验证

受 `NOTIFICATIONS` 权限保护的待跟进接口返回 `items`、`total`、`nextOffset` 和队列快照，每页最多 100 条。队列仍只收录有外部发送任务、状态不确定或发送不可用且站内未读、尚未记录人工跟进的通知。队列成员或外部状态变化后，旧快照续页返回 `QUEUE_CHANGED`；运营页据此从第一页刷新，普通读取失败可重试原页。运营状态栏显示完整待办数，页面可逐页查看和处理。

`test/notification-followups.test.ts` 使用 105 条本地通知验证跨页覆盖、无重复、无效续页和队列变更。`test/operator-ui.test.ts` 验证总数、加载更多、变化后重读及失败重试。验证使用 PGlite、本地 HTTP 和页面逻辑模拟，不构成微信开发者工具或真机交互证据。微信开发者工具的 Codex 页面自动化授权仍为 `pending`；微信订阅模板、实际送达回执和真人跟进仍缺。

本次全量 `pnpm test` 为 202/202 通过，`pnpm typecheck` 与 `git diff --check` 通过。
