# AI 草稿建议标识传播：本地与开发者工具验证（2026-09-28）

本轮复用第 52 版 `ai_draft_requests.event_id` 与已保存的合成提供方结果。服务端只在该活动存在 `COMPLETED` 且 `result.aiStatus=GENERATED` 的记录时返回 `aiSuggestionGenerated: true`；预算降级或纯手工草稿不会被标记。该标记的含义是“此活动曾生成 AI 草稿建议”，不声称最终活动文字全部由 AI 编写，也不声称建议已经人工核实。

本人活动详情、匿名有效邀请摘要和本人数据导出均可回读这一标记。活动页显示来源提示；主办分享卡标题加上“曾生成 AI 建议”。服务端从已持久化的请求记录派生标记，不接受客户端自报。定向 HTTP 与小程序测试先观察到缺失标记／分享标题，再通过 **93/93**；最终主工作树 `pnpm test` **537/537**、`pnpm typecheck` 与 `git diff --check` 通过。

微信开发者工具以测试环境合成提供方、本地 API 和开发身份 `ai-label-host` 实际打开 `pages/event/event`。自动化页面数据读取 `aiSuggestionGenerated: true`，渲染节点 `#aiSuggestionNoticeView` 的文字包含“曾生成 AI 草稿建议”，退出码 0。小程序 CLI 预览构建通过，包体约 345.1 KB。分享卡标题由小程序 VM 测试覆盖；本次模拟器没有实际投递分享卡。

真实模型、供应商数据处理与适用标识规则、正式 AppID、真机及对外分享投递仍未验证。此标记是保守的来源事实，不替代发布前法律及平台审核。
