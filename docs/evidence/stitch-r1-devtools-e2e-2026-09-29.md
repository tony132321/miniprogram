# Stitch R1 新增交互的开发者工具端到端回归（2026-09-29）

使用微信开发者工具 36.6.0 CLI `auto` 启动隔离的小程序副本 `/private/tmp/project-irl-devtools-20260929-r1`，自动化端口为 `9422`，测试 AppID 为 `wxbbcab69099026d3f`。`diff -qr --exclude=config.js miniprogram /private/tmp/project-irl-devtools-20260929-r1/miniprogram` 退出码 0；副本只将 API 指向独立的 `127.0.0.1:3001` 合成 PGlite 服务。更新页签状态后的隔离副本 CLI `preview` 退出码 0，包体 1,858,365 Byte。`miniprogram-automator` 连接此模拟器并实际触发页面按钮；下列结果均用隔离服务本人接口回读，不是通过直接修改数据库伪造页面状态。

| 场景 | 模拟器操作与服务端回读 | 截图 |
| --- | --- | --- |
| PG05 报名确认 | 在合成活动 `e4f390d1-c1d1-4cb8-9d1f-251c67c1d0b3` 的详情点击 `#joinButton` 打开页内确认层，点击取消回到活动，再次打开后点击 `#confirmJoinButton`；自动审核活动的本人 `/me/registrations` 回读 `CONFIRMED`，页面出现已确认成功卡，成功卡详情按钮可返回活动。 | [确认层](screenshots/stitch-r1-2026-09-29/pg05-confirmation.png)、[确认成功卡](screenshots/stitch-r1-2026-09-29/pg05-joined.png) |
| 手动申请和主办审批 | 活动 `1eeb81db-dc7c-4a96-8698-e498978b3a76` 的另一合成身份确认后服务端状态为 `REQUESTED`。主办身份打开消息页并点击“互动消息”，真实申请卡出现；“查看详情”进入对应活动的主办区，返回后点击“一键通过”，申请人状态回读 `CONFIRMED`、主办待审核总数回读 0。 | [真实申请卡](screenshots/stitch-r1-2026-09-29/messages-approval.png) |
| 全部已读 | 申请人消息页初始显示 2 条未读，点击“全部已读”后页面显示 0 条未读，`/me/notifications` 回读两条均为 `OPENED`。 | [已读后消息页](screenshots/stitch-r1-2026-09-29/messages-all-read.png) |
| 满员审批 | 合成申请 `9e605066-17c5-4a07-b713-26bb65f73345` 仍出现在互动消息；API 返回 `canApprove:false`，页面没有 `.approval-accept` 按钮，显示“名额已满，暂不可通过”，保留查看详情。 | [满员提示](screenshots/stitch-r1-2026-09-29/messages-full-capacity.png) |
| 活动提醒 CTA 与签到区 | 合成活动 `1a140595-c7d5-42b8-9fe8-f9d1a321811f` 经 3 名成员报名、主办确认及提醒任务产生真实 `EVENT_REMINDER` 站内通知。成员消息页初始 `unreadTotal:3`，提醒卡显示“查看签到与入场凭证”；点击后进入 `pages/event/event`，查询参数 `section=checkinSection`，页面加载成功并渲染 `#checkinSection`。本人通知接口回读该条通知由 `IN_APP` 变为 `OPENED`，`unreadTotal` 变为 2。修复页签状态后在同一隔离服务复测，页面 `activeSection` 为 `checkinSection`，唯一高亮页签为“签到”，滚动位置为 1372.5。 | [点击前提醒卡](screenshots/stitch-r1-2026-09-29/messages-reminder-cta.png)、[首次跳转](screenshots/stitch-r1-2026-09-29/event-checkin-from-reminder.png)、[页签修复后复测](screenshots/stitch-r1-2026-09-29/event-checkin-active-from-reminder.png) |

自动化恢复脚本 `/private/tmp/project-irl-automator/messages-e2e-resume.cjs`、提醒 CTA 脚本 `/private/tmp/project-irl-automator/reminder-cta-e2e.cjs` 及页签复测脚本 `/private/tmp/project-irl-automator/reminder-cta-active-e2e.cjs` 均退出码 0。首个组合脚本曾因测试脚本等待页面异步加载的时机过早而断言失败，随后在同一隔离服务中等待加载完成并重新执行上述交互，未观察到产品请求失败。页签复测首次误接空数据库而找不到提醒卡，更正为原隔离数据库后通过；该失败未指向产品代码。隔离 API 与 CLI 自动化副本在取证后关闭。该记录只证明表内按钮在测试号和本地服务的开发者工具模拟器交互；其他 R1 按钮、正式 AppID、合法域名、真机触控、外部订阅消息或真人活动不在此次点击范围。Computer Use 前台读取本次超时，按钮实测由用户指定的开发者工具 CLI 与 automator 完成。
