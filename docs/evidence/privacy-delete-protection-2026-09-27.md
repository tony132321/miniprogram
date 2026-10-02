# RQ18 / T27 / T32 删除申请的即时保护证据

日期：2026-09-27。范围是申请受理后的低风险保护和旧申请启动补保护；未执行资料删除、去标识或保留到期清理。

## 实现状态

- 第 47 版迁移为 `privacy_requests` 加入 `protection_applied_at`、`consents_revoked_count`、`aliases_removed_count`，并为授权变更历史加入 `source`。既有数据不会因结构迁移被标成已保护。
- 新的 `DELETE` 请求在同一数据库事务中锁定现有用户行、复用该用户未结请求、撤回已授予的 `EVENT_REMINDER` 和 `SIMILAR_ACTIVITY_INVITES`、为每次实际撤回写入 `source=DELETE_REQUEST` 的历史、移除活动昵称、写入不含昵称或微信标识的审计。随后状态为 `PROTECTED_PENDING_POLICY`，本人回执含保护时间及实际撤回数量。原幂等键的旧 `OPEN` 回执重放也会补做保护。
- 服务启动时、开始监听前，`protectPendingDeletionRequests` 按用户补保护旧 `OPEN` 请求。重复执行不重复写入撤回历史或审计；同一用户的其他未结旧请求同步标记保护已生效，实际撤回数量只计入执行该动作的请求。补保护失败会阻止服务监听。
- 已排队的外部通知在联系服务商前再次检查未结删除申请；授权重新开启、再约候选和活动内昵称设置／展示亦检查。本人仍可撤回授权和昵称。现有停用账号拦截继续生效。
- 本人导出包含保护时间、撤回计数及授权历史来源；未保护的旧请求显示 `NOT_APPLIED`，不会声称已经完成保护。

## 已验证

- 回归先复现外部发送、再约候选、昵称展示三处缺口；定向修复后，`test/notifications.test.ts`、`test/event-aliases.test.ts`、`test/lifecycle.test.ts`、`test/blocks.test.ts` 共 **69/69** 通过。
- `test/privacy-request-safeguards.test.ts` 的 **5/5** 项通过：新请求事务保护、同一未结请求复用、旧幂等键补保护、写入失败整笔回滚、文件数据库重启后旧申请补保护及重跑幂等。
- 本人 HTTP 接口回读已在 `test/api.test.ts` 验证保护状态和未执行删除的说明；个人导出的新增字段由真实数据库测试校验。

## 仍须完成的验收

- `PROTECTED_PENDING_POLICY` 表示通知与公开昵称等即时保护，**不表示**账号停用、全部个人数据删除、去标识、争议记录隔离保留或备份副本处理完成。
- 开发包中的 `retention_policy.json` 仍是未批准提案，资料类别的法律依据、访问权限、保留期限与删除动作需要数据负责人逐项批准。实际删除执行、备份恢复后删除标记重放以及目标环境演练尚未建立和验证。
- 当前验证使用本地数据库与合成身份。正式 HTTPS 域名、微信正式 AppID／模板、真机和目标 PostgreSQL 环境证据仍需补齐。
