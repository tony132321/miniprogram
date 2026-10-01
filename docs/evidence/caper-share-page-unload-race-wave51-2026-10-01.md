# 分享页离开时取消邀请码异步操作（2026-10-01）

## 范围与原因

`subpackages/activity/share/share.js` 原先在 `onHide`、`onUnload` 只取消海报和有效期计时器。`copyInvite()` 挂起的活动重读返回后，仍能调用 `wx.setClipboardData`；分享意向请求若在页面隐藏后又显示，旧响应也能写入新的分享状态。

## 修复

- 隐藏或卸载时立即清除邀请码、分享来源、弹层和准备状态，并递增页面与数据请求版本。
- 重读、复制、分享意向、海报绘制及其回调仅在本次页面仍可见、版本仍一致时继续。卸载页面不能重新显示；隐藏页面返回后重新读取服务端资格。
- `onShareAppMessage` 在隐藏或卸载期间只返回普通首页路径。

## 定向验证

- 先新增挂起活动读取的用例，观察到 `onHide` 和 `onUnload` 后剪贴板仍被写入；另观察到隐藏再显示后旧分享意向会写入 `sourceToken`，以及首次返回显示未重读资格。修复前这些断言为红。
- 修复后运行 `node --import tsx --test --test-concurrency=1 test/miniprogram-caper-share.test.ts`：**32/32 通过**。其中覆盖隐藏、卸载、旧请求返回、返回后重读，以及海报资格请求隐藏后不再绘制私密二维码。
- `node --check miniprogram/subpackages/activity/share/share.js` 和相关文件 `git diff --check` 通过。
- 相邻海报测试首次扩展运行时有 6 项夹具不匹配：其活动桩缺少新服务字段 `inviteRemainingMs`，活动页路由桩也缺服务有效期前提。主智能体补齐夹具后，联合运行 `test/miniprogram-caper-share.test.ts test/miniprogram-caper-poster.test.ts`：**39/39 通过**。

本证据限本地定向测试，不代表真机、订阅消息或生产环境验收。
