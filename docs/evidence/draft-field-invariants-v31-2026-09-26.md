# T08/T09 草稿字段不变量本地验证（2026-09-26）

复用现有 `createDraft`、`updateDraft`、`validatePublish`。空缺字段允许逐步补全；已提交但类型错误、负费用、无效日期、时间倒序或人数上限小于下限的草稿在保存入口返回 `INVALID_EVENT`。拒绝更新后，原草稿的版本与内容保持不变。发布仍完整检查必填字段；对迁移前可能存在的损坏数据，测试直接构造旧记录以证明发布不会绕过校验。

## 执行结果

- 首次新增的保存测试失败于 `Missing expected rejection`，实现后 `test/events.test.ts` 与 `test/api.test.ts` 31/31 通过；全量 `pnpm test` 277/277 通过，`pnpm typecheck` 与 `git diff --check` 通过。运行时使用 Codex 自带 Node 路径补入 `PATH`，没有修改项目配置。
- 微信开发者工具 0.3.11 模拟器中，发起页只填标题“部分草稿验收”并点“保存草稿”，服务端返回 `DRAFT`、版本 1，页面显示“草稿已保存”。[模拟器截图](draft-partial-save-simulator-2026-09-26.jpg)。
- 对这条本地测试草稿绕过前端发起 `POST /events/{id}/draft`，发送 `{"expectedVersion":1,"patch":{"feeCapFen":-1}}`，得到 HTTP 400、`INVALID_EVENT` 与中文修改提示。随后单独 GET 同一草稿，仍是版本 1、费用上限 5000 分、未填写的城市与场馆仍为空。

该证据使用开发身份、本地 PGlite 与模拟器。真实微信身份、真机日期/金额控件、目标 PostgreSQL 与完整预约依据仍须单独验收。
