# 用途级保留策略启动闸门（2026-09-27）

候选和生产启动现在在数据库连接前要求 `RETENTION_POLICY_JSON`。校验六类用途记录、逐类期限或触发条件、依据、删除动作与访问角色；缺失、未批准、全库单一类别、重复类别或占位依据均拒绝。首版未启用的语音原始文件与照片可声明 `NOT_ENABLED`；普通资料、草稿原文、争议日志和备份不得如此跳过。

- `pnpm exec tsx --test test/retention-policy.test.ts test/startup.test.ts`：12 项通过；`pnpm test`：401 项通过，0 项失败；`pnpm typecheck`、`git diff --check`：通过。
- 用校验器读取用户提供的 v3.1 开发包 `ops/retention_policy.json`，该原始 `OWNER_REVIEW_REQUIRED_BEFORE_REAL_DATA` 提案被拒绝。候选阶段缺少策略的进程启动测试同样在数据库前失败。
- 测试中的“已批准”配置是**合成数据**，仅验证格式分支；没有真实负责人批准或真实保留期限。配置格式校验不能证明实际删除执行器、法定依据、备份轮换或恢复后删除标记重放完成。
