# 停用账号的微信登录边界（2026-09-27）

此前 `actorFromBearer` 会拒绝非 `ACTIVE` 用户的旧令牌，但 `loginWithWechat` 遇到同一微信 openid 时仍会签发一个新会话。现在登录事务在取得用户行后检查当前状态，非 `ACTIVE` 返回 `403 ACCOUNT_DISABLED`，事务不会写入新会话或把账号重新激活。

- 先新增失败测试，复现停用用户仍取得新令牌；修复后 `test/login-replay.test.ts` 的函数与 HTTP 两条路径均通过。测试还确认旧令牌失效、用户状态仍为 `DISABLED` 且没有新增会话。
- 与协办、试点准入相关的定向测试 14 项通过；全量 `pnpm test`：405 项通过，0 项失败；`pnpm typecheck`、`git diff --check`：通过。

这是注销流程将来需要的认证边界，**没有**实现停用决定、完整撤销展示、数据删除或备份恢复重放。正式微信 AppID 与真机登录仍未验收。

## 候选版补充：停用后的外部通知与活动昵称

新增两条合成数据回归，先观察失败：已排队的 `REGISTRATION_STATUS` 对停用账号仍调用外部提供方（实际调用对象为 `p1`、`p2`，预期只有仍为 `ACTIVE` 的 `p2`）；已停用成员的旧活动昵称仍出现在另一成员的活动昵称列表。两条定向用例初次运行均失败，原因对应现有发送末端和昵称查询缺少用户状态检查。

修复后，外部通知在最终调用提供方前对已有用户行加 `FOR SHARE` 状态检查；非 `ACTIVE` 时将原通知的 `external_status` 记为 `ACCOUNT_DISABLED`，不调用提供方。用户状态变更需要更新同一行，因此已完成的停用状态不能被后续发送越过。原站内通知与报名审计仍在，另一个仍活跃成员的通知照常送至测试适配器，且仍可退出报名。昵称列表只过滤已有的非 `ACTIVE` 用户行，不删除原昵称记录或审计；本地开发夹具中未创建用户行的身份继续按既有测试行为显示。此项仅是显示与发送边界，不能替代真正注销时的资料处理。

- `pnpm exec tsx --test --test-name-pattern='queued external notice skips|disabled member nickname disappears' test/notifications.test.ts test/event-aliases.test.ts`：修复前 0/2，两个失败均为预期行为缺口。
- `pnpm exec tsx --test test/notifications.test.ts test/event-aliases.test.ts`：修复后 20/20，退出 0；`pnpm typecheck`、`git diff --check`：退出 0。

测试用 SQL 将合成用户状态设为 `DISABLED`，未执行真实停用或删除请求，也未调用真实消息供应商。本轮未运行全量测试；全量回归由候选版统一验证负责。
