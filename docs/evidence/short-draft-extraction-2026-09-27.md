# 简短口语草稿解析验证（2026-09-27）

复用 `src/ai.ts` 规则降级与既有 `/events/drafts:suggest-local` 接口，补齐“周六晚八点”和“AA 大概五十”的解析。费用估计写入建议上限，但标为 `NEEDS_CONFIRMATION`；没有城市时不推断日期，已过去的“本周六”时间也不返回过去的开始时间。

- `pnpm exec tsx --test test/ai.test.ts test/ai-provider-boundary.test.ts test/ai-provider-http.test.ts`：12 项通过。
- `pnpm test`：397 项通过，0 项失败；`pnpm typecheck` 与 `git diff --check`：通过。
- 微信开发者工具 v0.3.11：编译打开 `pages/create/create`，输入“周六晚八点在深圳打羽毛球，六人AA大概五十”并调用页面 `suggest`。页面实际显示“开始时间：2026-10-03 周六 20:00（来自原话）”“最多人数：6（来自原话）”“每人费用上限：50 元（待确认）”；场地及主办是否参加仍未确认。演练使用本地开发服务和测试号，完成后已停止服务。

规则仍只覆盖明确的中国城市及有限句式；真实模型、多城市时区和真机验收未由此证明。
