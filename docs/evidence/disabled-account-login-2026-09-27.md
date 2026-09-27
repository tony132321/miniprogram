# 停用账号的微信登录边界（2026-09-27）

此前 `actorFromBearer` 会拒绝非 `ACTIVE` 用户的旧令牌，但 `loginWithWechat` 遇到同一微信 openid 时仍会签发一个新会话。现在登录事务在取得用户行后检查当前状态，非 `ACTIVE` 返回 `403 ACCOUNT_DISABLED`，事务不会写入新会话或把账号重新激活。

- 先新增失败测试，复现停用用户仍取得新令牌；修复后 `test/login-replay.test.ts` 的函数与 HTTP 两条路径均通过。测试还确认旧令牌失效、用户状态仍为 `DISABLED` 且没有新增会话。
- 与协办、试点准入相关的定向测试 14 项通过；全量 `pnpm test`：405 项通过，0 项失败；`pnpm typecheck`、`git diff --check`：通过。

这是注销流程将来需要的认证边界，**没有**实现停用决定、撤销展示、数据删除或备份恢复重放。正式微信 AppID 与真机登录仍未验收。
