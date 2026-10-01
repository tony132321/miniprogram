# T31 活动关联举报状态业务事件（2026-10-01）

## 合约与既有实现

开发包 `engineering/tasks/T31.md` 的 `AC-ANALYTICS-PRIVACY` 要求服务端成功埋点带活动、版本、来源及测试标记且不含敏感全文；PRD §21.3 把普通举报及申诉率列为护栏，§21.4 要求服务端成功事件按统一字段生成。现有代码已将活动关联举报创建记为 `business_events.CREATE_REPORT`，无活动 ID 的举报状态则由第 66 版迁移进入仅聚合的 `system_business_events`。活动关联举报的 `REPORT_STATUS` 审计在进入人工核查及普通结案后没有相应业务事件，无法从活动事件流还原这两次成功状态变化。

## 本次增量

第 71 版迁移只处理带 `event_id` 的 `REPORT_STATUS` 审计。进入人工核查生成 `REPORT_IN_REVIEW`，普通结案生成 `REPORT_RESOLVED`；二者复用既有活动事件字段、伪名化操作者、审计 UUID 及事务边界，不包含工单 ID、正文或处理理由。结项争议的具名裁决仍由第 55 版映射为唯一的 `OUTCOME_REVIEW`，不再生成普通结案事件；无活动 ID 的举报继续使用第 66 版聚合流。迁移不回填旧审计，因为旧状态时的活动版本不能可靠重建。

## 定向验证

先为真实 `createReport → assignReport → changeReportStatus` 路径写回归，首次运行失败：实际只有 `CREATE_REPORT`，缺少 `REPORT_IN_REVIEW` 与 `REPORT_RESOLVED`。加入迁移后，该用例通过，并核对同键重放不新增事件、审计 UUID 一一对应、分析行和审计 `detail` 不含举报正文、活动级举报不进入无活动聚合流。既有结项争议测试追加断言：裁决结案只有 `OUTCOME_REVIEW` 一条事件。无活动举报原有聚合流测试保持通过。

| 检查 | 结果 |
| --- | --- |
| 红测：新增活动举报用例，实施前 | **0/1**；预期缺失两条事件 |
| `node --import tsx --test --test-concurrency=1 test/business-events.test.ts test/outcome-review.test.ts test/system-business-events.test.ts` | **14/14** |
| `node --import tsx --test --test-concurrency=1 --test-name-pattern='schema migration is recorded once' test/db-migration.test.ts` | **1/1** |
| `node node_modules/typescript/bin/tsc --noEmit` | 退出码 **0** |
| `git diff --check` | 退出码 **0** |

本轮使用项目绑定的 Node 运行时在本机 PGlite 隔离库验证；未跑全量测试、目标 PostgreSQL 升级、CI、微信开发者工具或真实运营工单。第 71 版 SQL 只有新函数与触发器定义，没有历史回填语句；旧报告事件不会被伪造为当时成功事件。
