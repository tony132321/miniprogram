# 通知查单与删除中收件人屏障（本地合成验证）

现有发送状态 `UNKNOWN_REQUIRES_RECONCILIATION` 可由具 `JOBS` 权限的运营人员通过 `POST /ops/notifications/:id/reconcile` 调用可选提供方查单适配器。接口需要幂等键并记录审计；查单结果为 `ACCEPTED` 时只记提供方受理，不声称送达或已读；`REJECTED` 记拒绝；超时、不可用、无效或不确定结果仍保持未知且不自动重发。此逻辑只用合成适配器验证，真实微信查单接口与回执尚未接入。

第 0062 版数据库触发器在通知写入前核对收件人状态和未终结删除申请。它覆盖通知服务调用、到期作业和直接 SQL 写入，避免删除中的账号继续产生新通知；既存通知保留，须按批准的用途策略另行处置。`test/notification-contract.test.ts` 覆盖查单、权限和幂等，`test/notification-deletion-fence.test.ts` 覆盖数据库屏障；相关通知／作业定向测试 43/43 通过。生产提供方、目标 PostgreSQL 和真机结果仍待验证。
