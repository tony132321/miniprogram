# 结项裁决脱敏业务事件（2026-09-27）

范围：T31 `AC-ANALYTICS-PRIVACY` 与 T24 `AC-OUTCOME-DISPUTE`。复用现有事务性 `audit` → `business_events` 触发器，第 39 版迁移只增加 `REPORT_STATUS` 中带有效结项裁决且已结案的 `OUTCOME_REVIEW` 映射。工单进入 `IN_REVIEW` 不产生成果事件。事件沿用活动版本、服务端测试标记、运营来源和操作者伪名，不复制结论、书面理由或举报正文；审计和受限裁决表仍可追溯原决定。

`test/outcome-review.test.ts` 先证明人审结案后事件数为 0，再验证一次结案产生一条、同键重试不增加、第二次独立裁决增加第二条，`IN_REVIEW` 不产生裁决事件。测试直接检查 `source=OPS`、版本 2、64 位伪名和事件行不含举报文本。与原 `test/business-events.test.ts` 一起运行 7/7 通过；全量 `pnpm test` 425/425、`pnpm typecheck` 和 `git diff --check` 通过。

使用已停止的合成 PGlite 恢复库从第 38 版升级到第 39 版：升级前有 1 条旧人工裁决审计、0 条 `OUTCOME_REVIEW`；升级后仍保留该审计，迁移数为 39，业务事件仍为 0。旧裁决不被迁移时间伪装为历史事件。此为本机数据库演练；目标 PostgreSQL 和真实运营账号仍待验。
