# RQ19 单场风险暂停期间的活动审核挡板（2026-10-01）

## 缺口与修复

隔离 PGlite 中创建邀请制草稿、发布成待审核活动、由运营设置单场 `ACTIVE` 风险暂停后，旧版 `reviewEvent(..., 'APPROVED', ...)` 仍返回 `APPROVED`，数据库的 `recruiting` 也变为 `true`。这与 RQ19“单场暂停阻断审核”不符。报名接口另有暂停检查，但审核决定和招募状态已经被错误改写。

活动审核事务先锁定活动行；放置和解除风险暂停也锁定同一活动行。现在仅在 `APPROVED` 分支、修改审核状态之前调用现有 `assertEventNotHeld`。暂停期间返回 `RISK_HOLD`，不写审核决定、不开放招募；解除暂停后可重新审核。`REJECTED` 仍可用于拒绝风险活动，与公开招募关闭时允许驳回的既有处理一致。

## 定向验证

- 新增真实数据库回归后先单独运行：**1 失败**，失败原因为 `Missing expected rejection`，与旧版错误批准相符。
- 修复后重跑同一回归：**1/1 通过**。暂停时保持 `PENDING`、`recruiting=false`、审核决定 0 条；解除后批准并恢复招募。
- `test/safety.test.ts`、`test/event-review.test.ts`、`test/public-gate.test.ts` 定向运行：**29/29 通过**，覆盖暂停期间驳回、既有审核时间窗和公开开关。
- `pnpm typecheck` 与 `git diff --check` 通过。

本次使用隔离合成数据库，未运行全量测试，未验证真实运营浏览器、目标 PostgreSQL 或正式微信环境。
