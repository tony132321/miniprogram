# 活动详情签到与结项时间入口（本地代码证据）

- 对照 `src/server.ts` 的动态签到码与 `src/lifecycle.ts` 的扫码、结项守卫：已成局或进行中的活动，签到窗口为开始前 30 分钟至结束后 30 分钟（含两端）；主办方结项从活动结束时间起可提交。
- 活动详情参与者扫码、主办方与协办方的三个动态码入口、主办结项表单与按钮均按该窗口展示。页面保持打开时，到边界自动更新；过期的已展示二维码立即清除。按钮回调再次计算时间，避免旧渲染状态直接发起请求。
- 未开放时在原入口展示开启或结束时间与原因。客户端时间只用于界面提示，服务端数据库时间继续作为提交的最终依据；本轮没有新增时钟同步接口。
- 新的 4 个场景测试先在旧实现失败，修复后与现有相关测试合计 **96/96** 通过；`pnpm typecheck` 与 `git diff --check` 通过。测试使用合成事件和可控设备时钟，尚未构成真机时间漂移或微信开发者工具交互验收。

验证命令：

```sh
node --import tsx --test test/miniprogram-event-time-controls.test.ts test/miniprogram-event-controls.test.ts test/miniprogram.test.ts
pnpm typecheck
git diff --check
```
