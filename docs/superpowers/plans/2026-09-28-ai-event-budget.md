# AI 草稿活动预算实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 RQ20 的 AI 草稿请求归属到服务端活动草稿，并在同一活动的并发及重复请求之间执行累计预算上限。

**Architecture:** 第一次模型提取前由服务端建立归属当前主办方的空草稿；后续提取沿用该活动 ID。数据库中的活动行是并发预算锁；每个请求在调用提供方前预留本次可用上限，已知费用按实际占用，费用不确定时继续占用全部预留额。客户端保留服务端返回的草稿 ID，后续保存与提取使用同一活动。

**Tech Stack:** TypeScript、Node HTTP、PGlite/PostgreSQL、微信小程序 JavaScript。

**Spec:** `Project_IRL_Autonomous_Engineering_Package_v3.1/01_PRD_v1.0.md` §17.4；`docs/ai-provider-boundary.md`。

## Global Constraints

- 不把 PRD 建议的 1 元／场硬编码为已批准预算；继续由服务端配置非负整数分。
- 生产 AI 提供方当前关闭；合成提供方验证不能替代真实供应商费用及账单核对。
- 同一请求键只调用一次；`UNKNOWN` 与费用下界不释放不确定的剩余额度。
- 规则降级、场地及发布确认、开发身份与真实身份边界保持现有校验。

## Review Focus

- 两个不同请求键同时消耗同一活动预算时，实际调用的预留额合计不得超上限。
- 未收到确定费用的请求不能把可能已消费的余额释放给新调用。
- 另一个主办方或另一个活动的 ID 不能复用当前请求键或预算。
- 首次响应丢失后，原键重放须指向同一个草稿并保持当前不确定状态。
- 用户放弃生成后留下的空草稿不得被算成已发布或真实试点活动。

---

### Task 1: 活动归属与数据库预算预留

**Files:** `src/migrations/0052_ai_event_budget.sql`、`src/db.ts`、`src/ai-draft-requests.ts`、`test/ai-provider-http.test.ts`。

**Interfaces:** `runRecordedDraftProvider` 增加 `eventId` 参数；活动预算沿用 `aiDraftBudgetFen` 配置。请求记录带 `event_id` 和 `reserved_fen`。旧请求归属保持空，不伪造历史活动。

- [x] 写测试：同一活动两请求在第一请求未结算时不超过额度；结算后只使用余额；未知费用持续占额；跨主办方被拒绝。
- [x] 运行定向测试，确认因缺归属或预算约束而失败。
- [x] 新增迁移，在同一事务锁活动行、核验草稿主办方与状态，并按已知费用或不确定预留额计算余额；写入请求前完成占额。
- [x] 运行定向测试、类型检查和本机 PostgreSQL 双池迁移验证。
- [ ] 提交数据库与服务端边界。

### Task 2: 首次提取的草稿生命周期

**Files:** `src/server.ts`、`src/ai-draft-requests.ts`、`test/ai-provider-http.test.ts`。

**Interfaces:** `/events/drafts:suggest-local` 接受可选 `eventId`；模型路径首次请求建立草稿并返回其 ID，后续请求必须复用它；规则路径不强制建立空草稿。

- [x] 写 HTTP 测试：首调创建一份草稿、同键重放不重复创建、后续请求沿用、他人草稿被拒绝。
- [x] 运行定向测试观察失败。
- [x] 复用 `createDraft` 的权限、幂等与审计边界，保证首调创建与请求归属可恢复；实现 HTTP 参数和响应。
- [x] 运行定向测试和类型检查。
- [x] 补充未发布草稿状态和跨活动同键断言。
- [ ] 提交 HTTP 生命周期。

### Task 3: 小程序绑定、证据与发布闸门

**Files:** `miniprogram/pages/create/create.js`、`test/miniprogram.test.ts`、`src/privacy.ts`、`src/server.ts`、`operations/index.html`、`test/operator-ui.test.ts`、`scripts/verify-postgres-ai-event-budget.ts`、`docs/ai-provider-boundary.md`、`docs/acceptance-matrix.md`、`docs/evidence/ai-event-budget-2026-09-28.md`。

**Interfaces:** 创建页在收到模型路径的 `eventId` 后设置当前草稿；之后提取与保存均附同一 ID。

- [x] 写页面测试：再次提取使用同一草稿；既有身份切换与异常重试测试继续执行。
- [x] 运行定向测试观察失败。
- [x] 实现页面绑定、运营汇总与本人导出；记录预算已知／不确定及规则降级的实际证据。
- [x] 运行页面及 HTTP 定向测试、534 项全量测试、类型检查及本机 PostgreSQL 双池迁移演练。
- [ ] 更新 PR 并等待当前 head 的 CI。
- [ ] 提交并同步 GitHub，保持生产 AI 闸门关闭直到供应商与预算获批。
