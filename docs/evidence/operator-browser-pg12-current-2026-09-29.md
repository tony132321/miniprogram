# PG12 当前候选本地浏览器实点（2026-09-29）

范围：以当前 `operations/index.html` 和 `src/server.ts` 启动独立内存 PGlite 服务，用 Google Chrome 154.0.8037.58 与 Playwright Core 操作真实 `/ops` 页面。验收入口为 [`scripts/verify-operator-browser-pg12.ts`](../../scripts/verify-operator-browser-pg12.ts)；每次运行创建合成活动、工单、账号与短期验证码，浏览器调用真实本地 HTTP，脚本在相同测试库回读状态和审计。没有使用 DOM 模拟响应，也没有写入正式运营环境。

本机复现命令：

```sh
PLAYWRIGHT_CORE_MODULE=/Users/tsb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core/index.mjs \
CHROME_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
pnpm exec tsx scripts/verify-operator-browser-pg12.ts
```

最终运行退出码 **0**，返回 `passed:true`、`pageErrors:[]`；`pnpm typecheck` 通过。脚本逐项断言并回读：

| 交互 | 本地结果 |
| --- | --- |
| 开发运营刷新、活动审核 | 待审邀请制活动和安全举报各 1 条；点击“通过”后 `events.review_status=APPROVED`，审核审计存在。见[初始队列](screenshots/pg12-current-browser-2026-09-29/ops-pending.png)。 |
| 内容审核与独立申诉 | 两条待审问题分别点击“通过”和“驳回”；原审核人点击“维持驳回”被拒，另一具名运营点击“撤销驳回并公开”后，申诉为 `RESOLVED/OVERTURN`、原内容为 `APPROVED`；有审核、申诉与撤销审计。 |
| 举报安全处理 | 点击首次响应关注、待分配列表、选取工单、逐单核查、改为高严重度、分派给具名处理人；受派账号点击“标记处理中”“结案并通知举报人”，数据库状态为 `RESOLVED`，逐单核查、改级和分派审计均存在。 |
| 风险与全局开关 | 点击单场暂停及人工解除，活动无活跃暂停；公开招募和全局新增分别关闭再恢复，最终均为开放，四条开关审计存在。 |
| 值守、人工工作与主办复核 | 浏览器创建合成值守，同一账号复核被拒，另一安全运营确认，创建者随后撤销；输入空人工时间收到校验，输入实际活动及 `0` 分钟后留下记录；开发账号不可调整主办级别，具名安全运营点击后成功。 |
| 通知、失败任务与隐私 | 无供应商适配器的合成通知由任务处理进入待跟进，点击“记录人工跟进”后历史和数据库留痕；向隔离库插入一条合成失败任务，点击“重新排队”后为 `PENDING` 且有 `RETRY_JOB` 审计；删除请求只点击“核查记录类别”，页面显示待政策复核和字段数量，未执行删除。 |
| 身份和恢复 | 错误密码未生成会话；具名账号登录与跨账号登录清空上一账号的私有输入和结果；仅举报权限账号无法查看指标、活动审核或操作暂停，访客刷新只见无权状态；退出后会话和私有列表清空。单独阻断 `/ops/metrics` 请求后显示“网络连接失败，请检查网络后点击刷新”，恢复请求并点击“刷新”后重读成功。见[受限账号页面](screenshots/pg12-current-browser-2026-09-29/handler-permissions.png)与[重试恢复页面](screenshots/pg12-current-browser-2026-09-29/network-recovered.png)。 |

最终脚本检查 16 类写入审计：`APPEAL_STATUS`、`CONTENT_REVIEW_OVERTURN`、`EMERGENCY_CLOSED/OPEN`、`EVENT_REVIEW`、`MODERATE_APPROVED/REJECTED`、`PUBLIC_RECRUITMENT_CLOSED/OPEN`、`RECORD_SUPPORT_MINUTES`、`REPORT_ASSIGNED`、`REPORT_SAFETY_INSPECT`、`REPORT_SEVERITY_CHANGED`、`RETRY_JOB`、`SAFETY_HOLD_PLACE/RELEASE`。本轮浏览器执行未发现需要修改的产品代码缺陷；验收脚本处理了页面异步刷新、刷新清空工单输入和一次性验证码防重放，避免将脚本时序误报为产品故障。

本轮仍未浏览器实点：100 条以上分页及队列快照冲突、异常报名行为证据、AI 草稿异常复核、真实失败任务产生与恢复后执行、通知外部送达与查单、批准保留策略后的隐私删除执行。上述部分已有独立代码测试或较早本地浏览器记录，但不能据此把本轮称为 PG12 所有控件端到端通过。正式运营凭据、独立真人值守、目标 HTTPS／PostgreSQL 部署、真实通知供应商与微信真机也不在本轮本地证明范围内。
