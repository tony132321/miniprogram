# PG08 完成态间距及 PG08/PG09 活动类型配图：隔离模拟器证据（2026-10-01）

## 对照与改动

- 参考稿来自用户 ZIP `stitch_design_system_generator/pg08/screen.png`、`code.html` 与 `pg09/screen.png`、`code.html`。原稿为聚会与屋顶餐饮背景，属于静态示意；当前验收活动的真实 `payload.type` 为 `badminton`，活动页已有 `display.isBadminton` 判断。
- PG08 完成态反馈卡前原有约 `115rpx` 空带，来自签到分区在所有状态共用的底部留白。现在只对 `COMPLETED` 状态的 `checkin-completed` 分区将底部留白收为 0；进行中状态仍沿用原规则。原[完成态截图](images/caper-pg08-feedback-restored-wave19-2026-10-01.png)与[修正后同样定位到反馈卡的截图](images/caper-pg08-completed-feedback-spacing-wave23-2026-10-01.png)可对照到场记录与结项卡之间的空隙。
- PG08 参与者签到背景及 PG09 AA 账本背景按 `display.isBadminton` 选择现有本地 `/assets/stitch/itinerary_badminton.jpg`；其他活动仍用各自原有本地场景图。两处均新增可见“活动类型示意配图”标注及图片无障碍说明，不能被误认为该场活动的真实照片。
- 只改 `miniprogram/pages/event/event.wxml` 与 `event.wxss`；未改数据映射、业务写入、签到账本或反馈行为。没有保留仅照搬 WXML/WXSS 的新测试。

## 定向验证

1. 本地隔离项目 `/private/tmp/caper-r1-e2e-20260930/miniprogram-project` 的 `event.js`、`event.wxml`、`event.wxss` 与当前工作区逐一 `cmp` 一致；本地合成 API 为 `http://127.0.0.1:3037`。
2. 微信开发者工具 CLI `preview --project /private/tmp/caper-r1-e2e-20260930/miniprogram-project --port 21467` 退出 0。测试 AppID `wxbbcab69099026d3f`，最终包体 **2,117,519 Byte**，自动化端口 `9495`。并行更新的 `event.js` 单独同步后重新预览和实点，本节画面来自最终同步状态。
3. `miniprogram-automator` 运行 `/private/tmp/project-irl-wave23-reference/pg08-pg09-scene-smoke.cjs` 退出 0，捕获页面异常 **0**。PG08 合成活动 `dca728a9-f387-4fbf-a301-4f8558ee2f6b` 为已结项羽毛球，已确认成员反馈尚未提交；实点渲染图片路径为 `itinerary_badminton.jpg`，[整页上部截图](images/caper-pg08-completed-scene-top-wave23-2026-10-01.png)可见示意标注，[反馈卡截图](images/caper-pg08-completed-feedback-spacing-wave23-2026-10-01.png)可见收紧后的间距。
4. 另经正常 API 发布、运营审核、四人确认及主办成局并记录一版 `¥100.01` AA 账本的羽球合成活动 `d9fe2434-1260-4cae-b921-27238e7a7956`，主办身份 `caper-pg09-art-muoljo3y-host`。PG09 实点 `feeMode=AA`、当前账本版本 1、羽球示意图片路径正确，“查看明细”按钮可展开并收起；[账本截图](images/caper-pg09-badminton-aa-scene-wave23-2026-10-01.png)保留真实金额、四人分摊行与示意标注。合成数据脚本在 `/private/tmp/project-irl-wave23-reference/seed-pg09-aa.cjs`。
5. PG06 另一合成活动 `d444bdcf-30ec-49f5-8913-a1855128cc36` 当前为 `IN_PROGRESS`，签到分区未带 `checkin-completed` 类；完成态的留白覆写未作用于进行中。模拟器最后恢复 PG08 上述活动的 `checkinSection` 反馈卡：[恢复截图](images/caper-pg08-completed-restored-wave23-2026-10-01.png)。
6. 既有事件分区导航与 PG09 账本交互定向测试 **16/16** 通过；独立反馈业务定向用例 **1/1** 通过；`pnpm typecheck`、`git diff --check` 均退出 0。按本轮要求未运行全量测试。

截图与实点只证明本地合成 API、隔离微信开发者工具模拟器中的状态和布局；没有真机、正式 AppID、线上 API 或真实活动的验收结论。
