# PG02-N1 通知动作与 PG10-H3 顶部路径补核（2026-09-30）

范围是现有 CAPER R1 布局的两个局部缺口；未运行全量测试，也未把设计稿的支付／费用通知当作已经上线的业务。

| 项目 | 核对结果 | 验证层级 |
| --- | --- | --- |
| PG10-H3 开源许可顶部更多／头像 | 在隔离微信开发者工具自动化端口 `9493`，从 `subpackages/profile/open-source/open-source` 实点顶部更多，菜单打开后实点“关于 Project IRL”，当前页为 `pages/about/about`；重新打开原页后实点头像，当前页为 `pages/me/me`。最后恢复 `pages/index/index` 且首页 `READY`，小程序异常 0。 | 当前布局真实模拟器点击；测试 AppID、本机 API、合成身份。 |
| PG02-N1 活动提醒签到 CTA | `messages.wxml` 的提醒卡主按钮把真实通知 `id`、`event_id`、`kind`、`actionSection` 传给 `openNotice`；`messages.js` 将 `EVENT_REMINDER` 和 `MANUAL_CHECKIN_REQUEST` 的目标分区设为 `checkinSection`，先导航到带当前活动 ID 的详情分区，成功后才标记通知 `OPENED`。聚焦现有测试已覆盖绑定、目标分区、URL 编码及导航失败不误标已读。 | 当前源码和 VM 页面方法测试；隔离队列 7 条通知中没有提醒，**未声称当前布局的真实提醒卡已在模拟器实点**。 |
| 原稿费用／结算通知 CTA | 当前通知种类无费用通知，费用记录由活动详情的 `expenseSection` 进入；没有平台支付、结算或费用通知投递。逐屏矩阵已移除“费用通知→费用区已接通”的过度表述。 | 代码和队列检查；这是 R1 范围边界，非真机未测的成功能力。 |

聚焦执行 `test/miniprogram-message-card-parity.test.ts`、`test/miniprogram-messages.test.ts`、`test/miniprogram-caper-profile-info-routes.test.ts`：**34/34 通过、0 失败**。开源页实点输出为 `about=pages/about/about`、`profile=pages/me/me`、`home=pages/index/index`、`errors=[]`。本记录不代表原生微信分享、真机扫码、39 屏逐像素或正式环境验收。
