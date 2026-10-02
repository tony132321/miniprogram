# PG10-A 活动内昵称入口定向证据（2026-10-01）

## 范围与门控

- 设计参照：`stitch_design_system_generator (2).zip` 的 `stitch_design_system_generator/pg10_a_edit_profile/screen.png`、`code.html`。PG10-A 昵称编辑入口落在资料页；当前 R1 没有全局昵称持久化，因此资料页仍明确标注“全局昵称暂未开放”。
- 本次只在 `profile-edit` 页面内增加“设置本场昵称”及本人活动选择面板。复用 `/me/events`，仅显示 `isHost === true` 或当前报名状态为 `CONFIRMED`、`RECONFIRM_REQUIRED`、`WAITLISTED`、`OFFERED` 的活动。选择后打开 `/pages/event/event?id=...&section=registrationSection`，由现有活动页和服务端的成员、同意说明、账号状态及注销申请门控处理保存和撤回。
- 未登录、无可设置活动及请求失败均有可见状态。离开页面、关闭面板、会话身份变化时清除候选活动；迟到的旧会话响应不能恢复列表。

## 验证

- 先运行新定向测试，改动前 3 项均按预期失败：入口缺失，`openAliasPicker` 不存在。
- 定向测试命令：`/Users/tsb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --import tsx --test test/miniprogram-profile-edit-alias-entry.test.ts test/miniprogram-caper-profile-visual.test.ts test/miniprogram-city-state.test.ts test/miniprogram-profile-scan-interest-entry.test.ts`。结果：25/25 通过。
- 类型检查命令：`/Users/tsb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node node_modules/typescript/bin/tsc --noEmit`。结果：退出码 0。
- `git diff --check` 针对本次三个页面文件和被影响测试：退出码 0。
- 初次扩展定向运行曾为 24/25；该既存测试的 VM `require` 桩未处理资料页原有的 `../../../utils/city.js` 顶层引入。已给 VM 加入现有 `cityModule` 的最小桩，未改变业务断言，随后 25/25 通过。

## 验收边界

本轮完成代码级定向验证；未改变当前微信开发者工具中的消息页状态，也未做此入口的开发者工具视觉验收或真机验收。活动详情页仍是昵称授权、保存和撤回的唯一真实操作入口。

## 审查后导航落点修正

- 独立审查发现：原入口只打开活动的“报名与成员”区顶部，已授权昵称和报名名单较长时，用户看不到本场昵称表单。现在资料页传入 `entry=alias`；活动页仅在同一活动、当前可编辑且昵称授权说明加载成功时，滚动到 `#aliasForm`。其他状态停留在报名区顶部，展示已有的权限或加载状态，不定位到不存在的表单。
- 最小新增用例先红：两个相关测试文件为 10/12，缺少新深链和表单定位。修正后连同 PG10 原有页面测试定向运行 14/14，通过；旧 PG10 VM 测试桩缺少资料页既有的城市模块导入，已补齐该测试依赖。类型检查、相关文件 `git diff --check` 均退出 0。
- 此落点仍待微信开发者工具实点确认；本轮没有运行全量测试或真机验证。
