# T06 `AC-LOGIN-REPLAY` 本地验证（2026-09-26）

复用现有 `loginWithWechat`、会话表和迁移机制。迁移 25 只存微信登录 code 的 SHA-256 摘要和交换时间；同一事务中先占用摘要，再创建用户会话。唯一约束使重复和并发请求至多一个成功，失败不会撤销首个有效会话。登录事务清理超过 24 小时的摘要；过期 code 的真实性仍由微信提供方判断。

`test/login-replay.test.ts` 先在原实现运行：同 code 重放没有被拒绝，并发提交两次均成功。改动后验证仅一个会话、原会话仍可用、无效 code 不留摘要或会话；迁移记录的完整性由 `test/db-migration.test.ts` 验证。

`pnpm test`：268/268 通过、0 失败；`pnpm typecheck` 与 `git diff --check` 均退出码 0。测试使用模拟微信交换适配器与本地 PGlite；正式微信 code 一次性语义、目标 PostgreSQL 多实例竞争和真机登录仍缺提供方及环境证据。
