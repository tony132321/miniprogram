# CAPER 消息首页三筛选与审批入口（Wave 26，2026-10-01）

## 参考与修复

用户提供的 `stitch_design_system_generator (2).zip` 中，`caper_3/code.html` 的消息首页在顶部显示“全部消息／活动相关／系统通知”三项筛选；`pg02_n_2/code.html` 的通知中心才显示含“互动消息”的四项筛选。当前小程序此前将四项同时放在消息首页与通知中心，导致首页筛选层级与参考稿不同。

本轮将 `pages/messages/messages.wxml` 的消息首页改为三项，通知中心继续保留四项。个人页发出的 `irlMessagesFocusIntent=approvals` 不再停留在首页的隐藏“互动消息”筛选，而是直接打开同路由通知中心的 `INTERACTION` 分类；待审核报名仍由 `/me/approval-requests` 读取。返回首页时恢复 `ALL`、显示 TabBar，当前未读总数不丢失。

## 聚焦验证

- 先扩充现有 `test/miniprogram-caper-message-parity.test.ts` 的审批意图用例，覆盖通知中心视图、真实审批队列、互动通知、TabBar 隐藏／恢复、未读数和返回 `ALL`。修复前单例测试 **0/1**，失败点为 `INBOX !== CENTER`。
- 修复后同一用例 **1/1**。消息相关四个测试文件合跑 **45/45**；`pnpm typecheck` 与 `git diff --check` 均退出 0。
- 本轮遵照用户要求未运行全量测试，也未在微信开发者工具实点或取得新版截图。测试只证明本地状态逻辑和现有 WXML 源码，视觉同尺寸对照及原生点击仍需补证。

本轮没有新增聊天、AI 消息或公开活动能力；通知与审批继续以当前身份的服务端数据为准。
