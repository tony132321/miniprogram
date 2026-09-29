# Stitch R1 公告、签到与费用的开发者工具点击回归（2026-09-29）

本次使用微信开发者工具 36.6.0 的 CLI `auto` 和 `miniprogram-automator`，在测试 AppID `wxbbcab69099026d3f` 下实际点击 PG07、PG08、PG09 按钮。小程序副本位于 `/private/tmp/project-irl-devtools-20260929-r1`，API 是 `127.0.0.1:3001` 的独立合成 PGlite 服务，自动化端口为 `9422`。开始前 `diff -qr --exclude=config.js miniprogram /private/tmp/project-irl-devtools-20260929-r1/miniprogram` 退出码为 0；这是后续 PG06 协办布局与首页协办分类补丁之前的小程序快照。副本 `config.js` 只改用隔离 API 和合成开发身份。所有操作经小程序页面发出，随后以对应身份从服务端 API 回读；未直接改数据库制造结果。

| 页面和场景 | 实际点击与服务端回读 | 可见截图 |
| --- | --- | --- |
| PG07 成员提问、公告与回答 | 合成活动 `1a140595-c7d5-42b8-9fe8-f9d1a321811f`：成员输入问题并点“提交问题”，`GET /events/:id/content` 回读问题 `ba31b503-4783-48d2-91e0-89d36b0bb34f` 为 `PENDING_REVIEW`。本地运营身份经审核接口批准后，主办分别点“提交公告”和“提交回答”，公告 `86109ac2-f59b-4aee-8d61-807d63b42272`、回答 `65fed9c2-53dd-44a2-acfa-2babe1805501` 均先回读 `PENDING_REVIEW`，回答的父项是该问题。运营批准两项后，成员重新打开页面，三项状态均为 `APPROVED` 且内容可见。 | [成员可见的问题、公告与回答](screenshots/stitch-r1-2026-09-29/pg07-content-visible.png) |
| PG07 当前事实查询 | 同一成员输入“活动几点开始？”并点“查询当前事实；未知事项交主办方”；页面答复为“当前版本 2：活动开始时间为 2026-09-29 07:31（Asia/Shanghai）”，与合成活动当前时间一致。 | 同上 |
| PG08 动态口令签到 | 同一活动已在进行中。主办点“展示动态签到二维码”，页面生成有效格式的动态口令；成员 1 在“现场动态签到口令”输入此口令并点“记录签到证据”。成员接口 `GET /events/:id/checkins` 回读签到 `8780cc27-930e-44d1-8d0a-78ecbe792e4d`，证据枚举为 `SCAN`。 | [签到区实际记录](screenshots/stitch-r1-2026-09-29/pg08-checkin-visible.png) |
| PG08 人工补记的同意与拒绝 | 主办分别对成员 2 和成员 3 点“申请人工补记到场”；主办接口均先回读 `PENDING`。成员 2 点“确认本人到场”，补记 `676438e8-3989-4ff4-b53a-8bbe90ebf0a3` 回读 `CONFIRMED`，到场证据为 `MANUAL_CONFIRMED`。成员 3 点“拒绝补记”，补记 `18bb325e-131f-4eed-a9b5-7bb7c44e2c97` 回读 `REJECTED`，其签到列表没有到场证据。 | [本人确认后的补记与到场证据](screenshots/stitch-r1-2026-09-29/pg08-checkin-visible.png) |
| PG09 超上限拒绝、费用建立与双方确认 | 合成 AA 活动 `9a1c1cdd-bbe2-454e-aeb4-a847ba4debe1`，4 人已确认，人均上限 6000 分。主办输入 `1000.00` 元点“记录 AA 分摊”，页面显示“人均费用超过发布时上限”，API 仍为 0 份账本；改为 `100.01` 元后，当前账本 `f2bd7253-0810-463f-b337-bb9f77ed4eed` 为第 1 版，总 10001 分，4 份合计 10001 分。成员 1 点“标记本人已处理”，本人份额回读 `participantHandled:true, hostReceived:false`；主办点“标记已收到”后，主办回读两个字段均为 `true`。 | [主办费用区](screenshots/stitch-r1-2026-09-29/pg09-expense-host-visible.png)、[成员费用区](screenshots/stitch-r1-2026-09-29/pg09-expense-member-visible.png) |
| PG09 修订后旧确认只留历史 | 主办输入 `99.99` 元点“修订 AA 分摊”；当前第 2 版 `3d11aa9c-6481-49b0-b768-bbd2fd5d4fe0` 总 9999 分，成员 1 当前的双方标记重置为 `false/false`；第 1 版保留历史记录及先前的 `true/true`，不能代表接受当前金额。成员页只显示自己的份额。 | [当前与历史账本的成员视图](screenshots/stitch-r1-2026-09-29/pg09-expense-member-visible.png) |

脚本与退出码：`pg07-pg08-stitch-e2e.cjs` 首次因 automator 不支持按源码 `bindtap` 属性选按钮而退出 1；改为查找实际按钮文字后，PG07 全链路通过，随后脚本将真实签到证据枚举 `SCAN` 错误断言为 `QR`，该组合运行退出 1。`pg08-manual-stitch-e2e.cjs` 首次因 DevTools automator 的 `wx.showModal` 不存在而退出 1；仅在隔离自动化上下文中注入“确认”回调后重跑，退出 0，签到、同意和拒绝都由页面按钮触发并经 API 回读。`seed-pg09-api.cjs` 首次误从审核响应读取邀请口令，报名返回 403；改为从主办的活动 GET 响应取口令，`finish-pg09-seed.cjs` 退出 0。`pg09-stitch-e2e.cjs` 退出 0，`visible-readback-stitch.cjs` 退出 0；另一次 PG07 可见截图命令退出 0。上述失败发生在合成脚本的选择器、断言、弹窗模拟或种子数据取值，不是产品服务端操作失败。

四张归档截图均在页面滚动到目标区块后目视检查：分别显示已审核 PG07 内容、PG08 本人到场证据、PG09 主办当前账本和成员当前及历史账本。早期组合脚本操作后触发页面刷新，所截画面停在顶部活动主视觉；那些截图没有作为区块可见证据。隔离 API 3001 与 auto 9422 已关闭，原有 9421 监听未受影响。

覆盖边界：本次在测试 AppID、本地开发身份和合成活动中验证了页面点击、页面状态及服务端回读。PG08 使用动态口令输入，未调用真机相机 `wx.scanCode`；主办发起人工补记时，自动化上下文注入了弹窗确认回调，未验证原生确认弹窗的手指触控。PG07 内容批准经本地运营 API 完成，未点击运营网页；未测未知事实待办、驳回复核。PG09 仅记录 AA 费用与双方状态，不涉及实际支付或收款。正式 AppID、HTTPS 合法域名、外部订阅消息、真机和真人活动仍需独立验收。
