# 活动状态与版本的历史指标口径（2026-09-27）

范围：RQ18、T31 的 WQCA、到期完成率、28 天主办复用及 D30 参与。此前 `getPilotMetrics(asOf)` 以当前 `events.status`、`events.payload` 解释过去：截止后取消或改期会改写旧报表的到期活动数量，以及 D30 待复核参与者数量。

第 41 版迁移新增 `event_status_history`。数据库触发器记录插入和真实状态变化，迁移时只快照旧活动的当时状态；迁移前无法证明的状态在历史报告中标为 `UNKNOWN_HISTORICAL_STATUS` 并进入待复核，不伪造完成或取消时间。查询按 `asOf` 选最后一个活动状态和 `event_versions` 版本，以当时规则决定自然周、结束时间和 28 天复用事件；D30 也不再引用截止后才完成的结项。状态表允许旧库中的未知状态值，以保持升级可执行。

测试先复现：截止后将活动取消并改到未来，旧实现把截止前应到期的活动从报表移走，且删掉已成熟的待核验首次到场。修复后旧报告保留 `dueEvents=1` 与 `pendingFirstParticipants=1`，新报告为 0。升级测试模拟第 40→41 版旧库，验证迁移前两条历史活动为待复核，迁移后的状态快照可读；本人导出仅向主办人提供该活动的状态时间线。定向 `test/metrics.test.ts`、`test/db-migration.test.ts`、`test/privacy-export.test.ts` 29/29、全量 `pnpm test` 429/429、`pnpm typecheck` 和 `git diff --check` 通过。

更新后的微信开发者工具 0.3.11：沿用隔离合成库 `.data/offer-history-sim-20260927`，本地 API 升级至第 41 版后，以开发身份 `host` 打开“我的与通知”，实际点击“复制本人数据 JSON”。页面显示复制成功；模拟器剪贴板回读 `hostedEventStatusHistory` 一条 `RECRUITING` 记录，`legacy_snapshot=true`，所属活动仅为 `sim-offer-history`。停止本地 API 后未留下运行服务。这验证旧活动状态快照进入主办人导出，不构成真机交互或真实活动状态变更验证。

旧活动在第 41 版前没有真实状态变更时间，不能据快照重放旧状态。其他随时间变化的报名成员范围、签到争议标记等尚未完整历史化；正式 PostgreSQL 迁移、真机和成熟真实试点报表仍待验。
