# 迁移 12 服务端业务事件验证（2026-09-25）

实现：`src/migrations/0012_business_events.sql` 把已提交审计动作转为同事务内的 `business_events`，字段与覆盖动作见 [事件字典](../business-event-dictionary.md)。公开待审提交不是成功发布，审核通过才生成 `ACTIVITY_PUBLISHED`；新表不回填迁移前历史审计。个人 JSON 导出按本人审计关联包含对应脱敏事件。

验证：先运行新测试观察 `business_events` 不存在的预期失败，再加入迁移。独立评审发现重复扫码与人工补记覆盖会虚增到场事件、主办方本人占位缺少报名事件；补充失败测试后已修正，再评审未发现这些修正的 P1/P2 问题。最终 `pnpm test` 为 129/129、`pnpm typecheck` 与 `git diff --check` 均通过。测试覆盖发布、报名、重放不重复、事务回滚、公开审核通过、首次签到、重复扫码、人工补记覆盖、事件脱敏字段及本人导出。全新本机 PostgreSQL 18.6 库 `irl_r1_test_business_events_final_20260925` 执行迁移 1–12、两连接池、100 人抢位和跨池事件／导出检查；输出 `migrations=12`、`confirmed=4`、`waitlisted=99`、`auditRows=106`、`personalExportCrossPool=true`、`personalExportSnapshot=true`，全部断言通过。实例已停止。

微信开发者工具 `2.02.2608070`：在本地测试号项目和独立 PGlite 目录 `.data/wechat-current-smoke` 上启动 `DEV_AUTH=1` API，刷新模拟器；以开发身份 `p1` 在“发起”页通过自动化注入一场 2026-10-06 的邀请制免费活动表单，调用页面的发布预览方法后，**实际点击**“以上均已核实，最终发布”。详情页返回 `RECRUITING`、版本 2、本人已确认 1 人，见[模拟器截图](wechat-migration12-business-events.jpg)。停止 API 后从同一库读取该活动的事件表，得到各一条 `ACTIVITY_PUBLISHED` 和 `REGISTER_CONFIRMED`，两条均为 `version=2`、`source=API`、`release=R1`、`is_test=true`、用户摘要长度 64；本次查询未输出摘要或邀请口令。

这证明本地事务与模拟器发布路径可用。表单控件逐项手工交互、真机相机、真实微信身份、正式 API 域名、外部分析平台投递和真实试点指标未验证。跨流程全量埋点与正式配套事件字典仍待补齐，不能据此声称 PRD §21 全部完成。
