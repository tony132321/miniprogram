# 发现页「附近」分类入口闭环（2026-10-01）

设计依据：`stitch_design_system_generator (2).zip` 中 `stitch_design_system_generator/caper_4/screen.png`、`code.html` 的顶部「附近」分类胶囊及中段「附近正在发生」模块。

原小程序顶部「附近」仅提示分类尚未开放，同页下方已提供明确的「附近活动待开放」说明和可用的城市选择入口。本批将顶部「附近」点击定位到该模块；城市按钮继续打开 `pages/city/city`。入口的无障碍名称说明目标是「附近活动状态与城市选择」，页面仍保持 `discoveryEnabled=false`、空公开列表，不产生附近活动、定位或可报名结果。无法读取目标布局的旧客户端沿用原有关闭态提示。

初版用 `wx.pageScrollTo({ selector: '#nearbySection' })` 将目标顶边对齐视口顶边。微信模拟器实点显示滚动值从 0 到 1038.5，但吸附的分类栏盖住了附近标题和状态卡，视口落在下一段「女生友好／与你有关的活动」。修正后用 selector query 同时读取附近标题位置、当前吸附分类栏底边和页面滚动值，以数值 `scrollTop` 把标题留在栏底以下 10 px。复点时标题位于视口顶端约 150 px，城市按钮与关闭态卡完整可见；[改后截图](images/caper-discover-nearby-wave47-2026-10-01.png)。

## 定向验证

- 新增 `test/miniprogram-discover-nearby-chip.test.ts`：初版测试先因没有滚动而失败；模拟器发现遮挡后，新偏移断言再次先红后绿，当前 **1/1**。测试核对布局测量、分类栏避让、城市路由和公开发现关闭状态。
- 发现页五个相关定向测试文件合计 **12/12** 通过；TypeScript `tsc --noEmit`、发现页 JS 语法及 `git diff --check` 通过。
- 隔离微信开发者工具 CLI `preview` 成功；模拟器点击顶部“附近”后页面 `scrollTop=889`、目标顶边约 149.5 px，实际点击同卡“选择城市”进入 `pages/city/city`。本次未运行全量测试或真机验收，也不证明设计原稿的公开附近活动能力。
