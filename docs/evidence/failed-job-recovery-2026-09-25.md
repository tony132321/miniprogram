# 失败任务恢复验证

后台任务重试五次后进入 `FAILED`，保留 `MALFORMED_JOB`、`UNKNOWN_JOB_KIND` 或受限的 `INTERNAL_ERROR` 等错误类别，不保存原始异常文本。运营接口与页面只向具有 `JOBS` 权限的独立账号显示任务 ID、种类、关联活动、原定时间、尝试次数和错误类别；不返回任务负载、通知内容或提供方信息。列表每页最多 100 条，队列变化后旧快照续页返回 409。

运营人员对 `FAILED` 任务可使用幂等键重新排队，操作记录 `RETRY_JOB` 审计；重复提交同一键返回原结果，任务处于其他状态时不能再次恢复。重新排队只把状态置为 `PENDING`，后续仍由持久任务工作器执行。`SEND_EXTERNAL` 对应通知若已进入不确定状态、已由提供方受理或不存在，接口拒绝直接重发，需先走通知人工跟进流程。生产启动要求具名 `JOBS` 权限人员；具体发放和值守仍待实际运营人员验证。

本地 PGlite/HTTP/页面逻辑测试覆盖未知任务、缺少活动或通知记录等损坏任务、五次失败、权限矩阵、105 条失败任务分页、负载不外泄、审计及幂等重试、外部通知不确定状态、生产启动闸门和页面操作。损坏任务不会被误记为完成。全量 `pnpm test` **216/216**、`pnpm typecheck`、`git diff --check` 通过。

本机 PostgreSQL 18.6 的全新空库 `irl_r1_test_failed_jobs_crosspool_20260925` 运行 `scripts/verify-postgres.ts`：迁移 1–17、两个独立连接池、100 人竞争、跨连接池读取失败任务与重试后执行均通过，输出 `failedJobRecoveryCrossPool=true`。测试实例已停止。这不证明目标部署环境的任务监控、人员响应时限、微信通知送达或故障恢复目标。

审查修复后新增迁移 18，为每次 worker 认领生成唯一令牌，最终成功或失败写入必须匹配当前令牌；旧 worker 无法覆盖重新认领或人工重新排队的状态。JSONB `null` 负载记为 `MALFORMED_JOB`，对应外部通知任务的人工重试返回受控错误。定向测试先在旧实现上复现两项失败，修复后通过；全量 `pnpm test` **218/218**、`pnpm typecheck` 和 `git diff --check` 通过。

另在全新空库 `irl_r1_test_job_claims_20260925` 运行 PostgreSQL 18.6 双连接池验收：18 次迁移、100 人竞争、失败任务恢复和过期 worker 认领隔离均通过，输出 `failedJobRecoveryCrossPool=true`、`staleJobClaimCrossPool=true`。本地测试实例已停止。
