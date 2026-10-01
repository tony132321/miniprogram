# `_1` 我的行程：顶栏与后续卡徽标局部对照

日期：2026-10-01。对照 `/Users/tsb/Downloads/stitch_design_system_generator (2).zip` 内 `_1/screen.png`、`_1/code.html`，当前行程页 WXML/WXSS，以及已有的[报名身份行程截图](images/caper-itinerary-wave7-member-2026-09-30.png)与[行程本地验证](caper-itinerary-local-2026-09-29.md)。

参考稿顶栏蓝色圆形入口是白色人形轮廓；当前页面显示棋子字形 `♙`。行程页现在复用发起页已在用的 WXSS 头部与肩部轮廓写法，维持原按钮大小、位置、无障碍标签和 `goProfile` 路由。参考稿后续日程的状态标签是胶囊形，现将原小矩形圆角改为胶囊圆角；列表的数据和排序未变。

原稿中的固定活动、永久 PASS、锁定队友和本地日历同步均是静态示例。本页仍从当前身份 `/me/events` 读取真实活动摘要，并明确提示以实时详情为准。此次仅改两个局部视觉细节，未更改 API、授权和详情路由。

验证：`test/miniprogram-itinerary.test.ts` **10/10**、`pnpm typecheck`、`git diff --check` 通过。未运行全量测试；开发者工具模拟器由并行任务占用，本次没有改后模拟器截图或真机、逐像素验收证据。
