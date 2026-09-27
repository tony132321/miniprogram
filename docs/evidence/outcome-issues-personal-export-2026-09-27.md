# 主办结项问题的本人导出复测（2026-09-27）

- 范围：RQ18 本人导出与 RQ13 结项信息隔离。第 30 版迁移新增的 `outcomes.issues` 由主办人填写；此前活动结果接口只向主办人返回该字段，但本人导出未包含它。
- 先在 `test/privacy-export.test.ts` 加入结项问题：主办人导出应包含原文，其他参与者导出不得包含原文。变更前定向测试因 `hostedOutcomes[0].issues` 为 `undefined` 而失败。导出查询补入该字段后，定向测试及 `pnpm typecheck` 通过；全量 `pnpm test` 为 379/379 通过。
- 使用已更新的微信开发者工具 `wechatide` 本地模拟器，在开发身份 `host` 的“我的”页实际点击“复制本人数据 JSON”。页面提示复制成功，调用模拟器 `getClipboardData` 回读并解析 JSON：`hostedOutcomes` 中保留 `异常：签到时短暂断网` 与 `场地问题：入口临时关闭，改走侧门`。底层 API 使用隔离的 `.data/outcome-issues-smoke` 合成数据。
- 测试同时断言参与者本人导出不包含主办记录。模拟器和合成数据不代表真实微信账号、真机、政策审批或删除执行验收。
