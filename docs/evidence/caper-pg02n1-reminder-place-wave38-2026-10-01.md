# PG02-N1/N2 活动提醒卡地点按钮（2026-10-01）

对照用户设计包 `stitch_design_system_generator (2).zip` 的 `pg02_n_1/screen.png`、`pg02_n_1/code.html`（约 88–97 行）与 `pg02_n_2/code.html`（约 50–60 行），提醒卡有入场与地点两个按钮。当前 R1 无地图坐标和导航服务，因此保留第一按钮「查看现场签到」到同场签到区，第二按钮明确标为「复制地点」。两按钮分别执行不同动作，不把剪贴板操作说成已打开地图。

第二按钮只接受当前账号已加载的真实 `EVENT_REMINDER` 通知行，逐项核对通知 ID、种类、活动 ID 和版本。点击后重新读取本人 `/me/registrations?eventId=…` 与 `/events/:id`：报名仍为同版 `CONFIRMED`、活动同版且仍在成局或进行中、审核状态可读、场馆非空，才复制当前 `city · venueName`。版本变化、退出报名、空场馆、换账号、重新加载或旧剪贴板回调都不会报复制成功；旧版本通知提示打开活动详情核对安排。点击复制本身不把站内通知标为已读。

## 定向验证

- 先写缺失按钮与资格边界测试；实现前本文件 **5 项失败**（缺少 `copyReminderVenue` 与绑定）。实现后消息页相关四个文件 **40/40** 通过，含通知行伪造、撤销席位、活动版本变更、空场馆、换会话异步响应与旧回调。`tsc --noEmit`、`node --check pages/messages/messages.js`、`git diff --check` 最终退出 **0**。没有运行全量测试。
- 完整小程序复制至隔离项目 `/private/tmp/project-irl-wave38-reminder/miniprogram-project`；`pages/messages/messages.js/.wxml/.wxss` 与工作区逐文件 `cmp` 均退出 **0**。仅副本 `config.js` 指向本地合成 API `127.0.0.1:3037`。微信开发者工具测试 AppID `wxbbcab69099026d3f`，CLI `preview` 退出 **0**（总包 **2,308,771 Byte**），`auto` 连接独立端口 **9538**。
- 通过正常合成 API 发布、审核、四人确认报名、主办确认成局后，服务端后台任务实际生成成员 `caper-wave38-reminder-muov1emw-member` 的 `EVENT_REMINDER` 通知 `672a7a1b-bc2b-4157-9cf0-37cccc712829`，活动 `82fe004a-10c6-4781-8be9-57b47c728e21`。活动、通知及本人报名版本均为 **2**，报名 `CONFIRMED`；没有注入假的前端通知卡。
- MiniProgram Automator 打开消息页、实点“通知中心”和该提醒卡的「复制地点」。[实点前提醒卡截图](images/caper-wave38-reminder-place-before-2026-10-01.png)展示双按钮。点击后 `wx.getClipboardData` 返回 **`深圳 · Wave 38 合成羽毛球馆`**，与点击后服务端活动当前 `city`、`venueName` 完全一致；通知前后均为 `IN_APP`，页面仍在消息中心，捕获小程序异常 **0**。合成数据与操作脚本保存在 `/private/tmp/project-irl-wave38-reminder/`。

证据仅证明隔离开发者工具中的站内真实合成提醒及地点复制；没有验证微信外部订阅消息送达、地图导航、真机剪贴板、39 屏逐像素或正式环境。版本或资格在最后一次 API 回读后再次变化，客户端无法提供原子保证，因此复制内容仍应以活动详情的最新安排为准。
