# T31 草稿成功事件定向证据（2026-10-01）

## 范围

PRD §21.4 要求业务成功事件来自服务端，并使用脱敏、版本、来源与测试标记字段。现有草稿创建和编辑已在同一数据库事务写入 `CREATE_DRAFT`、`UPDATE_DRAFT` 审计，但此前的活动业务事件映射遗漏这两个动作。第 68 版迁移新增单独的审计触发器，把成功创建和修订分别记录为 `DRAFT_CREATED`、`DRAFT_UPDATED`，复用 `business_events` 既有字段和数据库内身份盐。原审计动作、原有业务事件语义及草稿接口均未改变。

## 可复核结果

- 先写定向用例，运行 `node --import tsx --test --test-name-pattern='successful draft creation and revision' test/business-events.test.ts`：退出码 1；实际事件为空，期望创建 1 条、修订 1 条，确认测试击中缺口。
- 加入第 68 版迁移后重跑同一用例：1/1，通过。继续运行 `node --import tsx --test test/business-events.test.ts`：7/7，通过；旧测试对新草稿事件与版本的预期已按业务事实更新。
- 旧库升级定向用例 `node --import tsx --test --test-name-pattern='draft event migration' test/db-migration.test.ts`：1/1，通过。模拟旧库已有草稿审计但无新触发器，升级后不回填旧记录；新修订写入 1 条第 68 版事件。
- `pnpm typecheck` 与相关文件的 `git diff --check` 均退出码 0。
- 独立检查个人导出受影响范围：`node --import tsx --test test/privacy-export.test.ts` **5/5** 通过；未扩展为全量测试。
- 创建与更新同键重放不增加事件，旧版本写入失败不增加事件；两条事件分别记录版本 1、2、真实测试范围、`API` 来源和脱敏操作者摘要，不含草稿原文。`event_uuid` 与源审计 ID 对齐。

此证据限于 PGlite 定向验证。未运行全量测试、独立 PostgreSQL 升级、微信开发者工具或正式试点指标；新的草稿事件也不表示草稿已发布或 AI 已生成。
