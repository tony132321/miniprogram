# PG06 主办工作台结项快捷入口：定向代码与模拟器验证（2026-10-01）

## 设计与业务边界

- 用户 Stitch ZIP：`stitch_design_system_generator/pg06/screen.png` 与 `stitch_design_system_generator/pg06/code.html`。画面底部有“分享活动 / 发送公告 / 结束活动”三个快捷按钮。
- 当前 R1 以服务端实际状态替代设计稿的静态状态。`pages/event/event` 原本已有主办结项表单和 `POST /events/:id/complete`；本次仅把符合结项资格时的第三个快捷按钮接到该表单，点击不直接提交。
- `canCompleteEvent` 只在当前主办方、活动为 `CONFIRMED` 或 `IN_PROGRESS`、时间有效且已到结束时间时为真。客户端在点击时重新计算；服务端继续以数据库时间、活动版本、主办身份及结项参数作最终校验。
- 尚未到结项时间的 `RECRUITING` / `CONFIRMED` 活动维持明确的“取消活动”入口；`IN_PROGRESS` 的未到期状态维持“签到管理”入口。取消和结项不能混用。

## 变更

- `miniprogram/pages/event/event.wxml`：第三按钮根据 `canCompleteEvent` 显示“活动结项”，并给现有结项表单添加定位 ID。
- `miniprogram/pages/event/event.js`：`openHostCompletion` 重新核对时间门控，之后只切到主办分区并滚动到现有表单。
- `miniprogram/pages/event/event.wxml`、`event.wxss`：两处原生结项说明输入框各限制为 `116rpx` 高度，保留 `bindinput` 与原有数据绑定。
- `test/miniprogram-host-completion-shortcut.test.ts`：覆盖到期前旧按钮状态不可被陈旧 `canCompleteEvent` 绕过、到期后滚动且不调用 POST、非主办不能触发，并核对原生 WXML 绑定、两处输入框高度。

## 定向验证

1. 新用例在实现前失败：`TypeError: page.openHostCompletion is not a function`，1 失败。
2. 快捷入口实现后：`node --import tsx --test test/miniprogram-host-completion-shortcut.test.ts`，1/1 通过。
3. 输入框高度用例先在未修正的 WXSS 上失败；加入专用规则后，同一测试文件 2/2 通过。
4. 既有 `event completion sends the host’s actual held choice and zero people when not held`，1/1 通过。
5. `pnpm typecheck` 与 `git diff --check` 均退出 0。

本轮按要求没有运行全量测试。没有真机、正式 AppID 或线上结项验收证据。

## 隔离微信开发者工具实点补充

- 将本次活动页 `event.js`、`event.wxml`、`event.wxss` 同步到 `/private/tmp/caper-r1-e2e-20260930/miniprogram-project`，三个文件逐一 `cmp` 均退出 0；隔离项目仍通过自己的 `config.js` 指向本地合成 API `http://127.0.0.1:3037`。其他并行开发中的个人页文件未用于本次活动页结论。
- 微信开发者工具 CLI `preview --project /private/tmp/caper-r1-e2e-20260930/miniprogram-project --port 21467` 退出 0；测试 AppID `wxbbcab69099026d3f`，最终包体 **2,116,739 Byte**，自动化端口 `9495`。
- 独立新建合成活动 `d444bdcf-30ec-49f5-8913-a1855128cc36`，主办身份 `caper-pg06-end-muojsyze-host`，经正常 API 发布、运营审核、四人确认报名、主办确认成局；结束时间 `2026-09-30T20:20:12.827Z`。与 PG08 反馈卡所用活动隔离。合成数据构建脚本：`/private/tmp/project-irl-wave19-devtools/seed-completion-eligible.cjs`。
- 自动化脚本 `/private/tmp/project-irl-wave19-devtools/pg06-completion-ui-smoke.cjs` 退出 0、页面异常 **0**。实际主办页 `loadState=READY`、状态 `IN_PROGRESS`、`canCompleteEvent=true`，第三快捷按钮文案为“活动结项”。[点击前的三按钮](images/caper-pg06-completion-shortcut-before-wave19-2026-10-01.png)已可见。实点此按钮后，同一路由滚动到现有“实际举办／未举办”结项表单：[修正输入框高度后的表单](images/caper-pg06-completion-shortcut-form-wave19-2026-10-01.png)。[旧的高输入框截图](images/caper-pg06-completion-form-before-layout-wave19-2026-10-01.png)仅作修正前对照。
- 两个原生输入框在隔离模拟器中分别输入合成说明，等待页面数据更新并核对内容，随后清空；未选择结项答案，未点击提交按钮。
- 点击前后 `GET /events/:id/outcome` 均为 404；最后再次回读活动仍为 `IN_PROGRESS`、版本 2，证明此次只是导航。模拟器随后恢复为 PG08 已结项活动的已确认成员反馈卡，`outcomeLoadState=READY`、未提交反馈：[恢复后的 PG08 页面](images/caper-pg08-feedback-restored-wave19-2026-10-01.png)。

原生 Computer Use 窗口读取因 macOS 锁屏返回“Mac is locked and automatic unlock could not unlock it”；上述截图和点击来自开发者工具 CLI 启动的 `miniprogram-automator` 会话。此证据仅覆盖隔离合成活动的模拟器渲染与一次按钮跳转，不能外推为真机、生产环境或 1:1 视觉验收。
