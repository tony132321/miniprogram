# 举报工单级权限本地验证（T05/T28，AC-REPORT-SCOPE）

候选代码新增向前迁移 `0044_report_assignments.sql`。正式命名运营账号即使有 `REPORTS` 权限，举报列表与状态更新也只对当前分配给本人的工单开放；重分配后旧处理人立即失去权限。安全运营的待分配队列只返回工单 ID、类型、状态和创建时间，不返回举报正文；被移除或不再有 `REPORTS` 权限的旧处理人名下工单重新进入此队列。安全运营逐单读取正文必须提交 10 至 500 字原因，同事务写入 `REPORT_SAFETY_INSPECT` 审计；分配给另一名当前具 `REPORTS` 权限的实名账号也记录原因和 `REPORT_ASSIGNED` 审计。安全运营自身不能用该权限修改举报状态或给自己分配工单。正式启动要求存在独立的 `SAFETY` 分派人员和 `REPORTS` 处理人员。

状态变更与分配、重分配均锁定同一 `reports` 行；新分配先提交时，旧处理人的状态变更读到新归属后返回 403。旧处理人先完成写入时，其变更先于分配生效。普通 `REPORTS` 账号访问隐私队列仍返回 403。仅显式本地开发身份 `operationsUsers` 保留旧的合成全权限入口，正式运行已禁止该入口；具名账号在测试与正式环境均执行所声明的角色权限。

验证命令：

- `pnpm exec tsx --test test/report-scope.test.ts test/operator-ui.test.ts test/operator-api.test.ts test/operator-permissions.test.ts test/report-queue.test.ts test/report-resolution.test.ts test/outcome-review.test.ts`：56/56 通过。
- `pnpm exec tsx --test test/startup.test.ts`：11/11 通过。
- `pnpm typecheck`、`git diff --check`：通过。

本地测试使用 PGlite、合成运营账号和工作台 DOM 交互。目标 PostgreSQL、真实账号分派与值守、浏览器端端到端操作仍需另行验收。旧版本已有工单迁移后保持未分配，由安全运营逐单分派；迁移不自动假造处理人。
