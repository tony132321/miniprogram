# Stitch R1 新增交互的开发者工具端到端回归（2026-09-29）

使用微信开发者工具 36.6.0 CLI `auto` 启动隔离的小程序副本 `/private/tmp/project-irl-devtools-20260929-r1`，自动化端口为 `9422`，测试 AppID 为 `wxbbcab69099026d3f`。`diff -qr --exclude=config.js miniprogram /private/tmp/project-irl-devtools-20260929-r1/miniprogram` 退出码 0，包含最新满员状态和 WXML；副本只将 API 指向独立的 `127.0.0.1:3001` 合成 PGlite 服务。隔离副本的 CLI `preview` 退出码 0，包体 1,857,445 Byte。`miniprogram-automator` 连接此模拟器并实际触发页面按钮；下列结果均用隔离服务本人接口回读，不是通过直接修改数据库伪造页面状态。

| 场景 | 模拟器操作与服务端回读 | 截图 |
| --- | --- | --- |
| PG05 报名确认 | 在合成活动 `e4f390d1-c1d1-4cb8-9d1f-251c67c1d0b3` 的详情点击 `#joinButton` 打开页内确认层，点击取消回到活动，再次打开后点击 `#confirmJoinButton`；自动审核活动的本人 `/me/registrations` 回读 `CONFIRMED`，页面出现已确认成功卡，成功卡详情按钮可返回活动。 | [确认层](screenshots/stitch-r1-2026-09-29/pg05-confirmation.png)、[确认成功卡](screenshots/stitch-r1-2026-09-29/pg05-joined.png) |
| 手动申请和主办审批 | 活动 `1eeb81db-dc7c-4a96-8698-e498978b3a76` 的另一合成身份确认后服务端状态为 `REQUESTED`。主办身份打开消息页并点击“互动消息”，真实申请卡出现；“查看详情”进入对应活动的主办区，返回后点击“一键通过”，申请人状态回读 `CONFIRMED`、主办待审核总数回读 0。 | [真实申请卡](screenshots/stitch-r1-2026-09-29/messages-approval.png) |
| 全部已读 | 申请人消息页初始显示 2 条未读，点击“全部已读”后页面显示 0 条未读，`/me/notifications` 回读两条均为 `OPENED`。 | [已读后消息页](screenshots/stitch-r1-2026-09-29/messages-all-read.png) |
| 满员审批 | 合成申请 `9e605066-17c5-4a07-b713-26bb65f73345` 仍出现在互动消息；API 返回 `canApprove:false`，页面没有 `.approval-accept` 按钮，显示“名额已满，暂不可通过”，保留查看详情。 | [满员提示](screenshots/stitch-r1-2026-09-29/messages-full-capacity.png) |

自动化恢复脚本 `/private/tmp/project-irl-automator/messages-e2e-resume.cjs` 退出码 0。首个组合脚本曾因测试脚本等待页面异步加载的时机过早而断言失败，随后在同一隔离服务中等待加载完成并重新执行上述交互，未观察到产品请求失败。隔离 API 已停止，副本已通过 CLI 关闭，端口 `3001`、`9422` 不再监听。该记录只证明上述按钮在测试号和本地服务的开发者工具模拟器交互；提醒卡入场凭证按钮、其他 R1 按钮、正式 AppID、合法域名、真机触控、外部订阅消息或真人活动不在此次点击范围。Mac 锁屏仍阻止 Computer Use 直接读取前台窗口，故此次使用用户指定的开发者工具 CLI 与 automator 完成按钮实测。
