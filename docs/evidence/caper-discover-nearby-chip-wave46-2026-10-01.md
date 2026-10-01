# 发现页「附近」分类入口闭环（2026-10-01）

设计依据：`stitch_design_system_generator (2).zip` 中 `stitch_design_system_generator/caper_4/screen.png`、`code.html` 的顶部「附近」分类胶囊及中段「附近正在发生」模块。

原小程序顶部「附近」仅提示分类尚未开放，同页下方已提供明确的「附近活动待开放」说明和可用的城市选择入口。本批将顶部「附近」点击定位到该模块；城市按钮继续打开 `pages/city/city`。入口的无障碍名称说明目标是「附近活动状态与城市选择」，页面仍保持 `discoveryEnabled=false`、空公开列表，不产生附近活动、定位或可报名结果。不能滚动的旧客户端沿用原有关闭态提示。

## 定向验证

- 新增 `test/miniprogram-discover-nearby-chip.test.ts`：测试先因没有滚动而失败，实现后 **1/1** 通过；核对定位目标、城市路由和公开发现关闭状态。
- 发现页五个相关定向测试文件合计 **12/12** 通过；TypeScript `tsc --noEmit`、发现页 JS 语法及 `git diff --check` 通过。
- 未运行全量测试、微信开发者工具实点或真机验收。此项只证明该入口的代码闭环，不证明设计原稿的公开附近活动能力。
