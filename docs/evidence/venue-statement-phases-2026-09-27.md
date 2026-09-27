# 场地主办声明的发布与变更留痕（2026-09-27）

- 范围：T09 `AC-RQ03`、`AC-VENUE-DUPLICATE`，以及 RQ09、RQ10。复用现有发起页场地确认开关、版本记录与成局事务；第 33 版迁移将结构化 `venue_evidence` 扩展为 `PUBLISH`、`CHANGE`、`FORMATION` 三个声明阶段，并记录活动结束时间。旧第 32 版成局声明回填为 `FORMATION`，保留原记录时间、记录人和场馆。
- 服务端发布成功时记录 `PUBLISH`；改场馆或活动起止时间，预览和最终写入都要求请求显式再次提交 `HOST_CONFIRMED`，成功后记录 `CHANGE`。人数不足或事务失败不产生 `FORMATION`；同一幂等请求不重复留痕。活动详情只展示与当前场馆、起止时间相符的最新声明；主办本人数据导出包含完整历史。
- 自动化：先复现发布无结构化记录、改场馆仍沿用旧勾选两个失败场景，再实现修复。`pnpm exec tsx --test test/lifecycle.test.ts test/event-review.test.ts test/api.test.ts` 为 87/87；`pnpm test` 为 384/384；`pnpm typecheck` 通过；`git diff --check` 通过。
- 迁移升级：已有合成 PGlite 库及已有 PostgreSQL 18.6 测试库均成功升至 33 版，分别保留 1 条、2 条历史 `FORMATION` 记录，活动结束时间与版本快照一致。全新隔离 PostgreSQL 库 `irl_r1_test_venue33_20260927` 完成 33 次迁移、两个连接池和 100 人并发报名（4 人确认、99 人候补）。同库双连接池另验 `PUBLISH → CHANGE → FORMATION` 三条记录、主办导出三条、缺少重新声明的改场馆被拒绝。
- 微信开发者工具 v0.3.11 模拟器：在发起页实际输入场馆并触发确认开关，发布后服务端活动详情回读 `phase=PUBLISH`；重新打开编辑页，实际改场馆使旧开关变为 false，未重新确认时页面拒绝预览；重新确认后预览仅显示场馆差异，最终提交后活动版本从 2 升至 3，活动页回读 `phase=CHANGE`。页面截图保存在本地忽略目录 `.data/venue33-event-page.jpg`，文字明确提示主办声明且未由场馆接口锁位。
- 边界：以上均是主办方声明，不证明场馆接受预约或库存已锁定。历史没有结构化声明的活动不补造记录。正式微信 AppID、HTTPS API、场馆真实预约依据、成人试点与真机验收仍待外部资源。
