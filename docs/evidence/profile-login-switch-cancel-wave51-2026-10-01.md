# “我的”页开发身份切换取消迟到登录（Wave 51，2026-10-01）

开发模式中，`login()` 已向 `/auth/wechat` 换票、但尚未返回时，点击“切换本地测试账号”会清除当前凭据并刷新页面。此前页面刷新代数只阻止旧结果更新 UI，`utils/api.js` 仍会在旧换票响应到达后写入 `sessionToken` 和 `userId`，使当前开发身份被旧微信会话覆盖。若 `wx.login` 回调本身迟到，旧换票甚至会在切换后才发出。

`setDevUser()` 现在先调用共享 API 的 `cancelLogin()`，递增现有认证代数。登录请求在收到 `wx.login` 回调时和 `/auth/wechat` 响应后均检查代数；已取消的旧流程不发送迟到换票，也不写本机凭据。当前本地身份的正常切换、后续主动微信登录及原退出登录流程保持可用。服务端已收到的换票请求无法由客户端撤回，本项只保证旧响应不会重新登录本机。

定向新测试 `test/miniprogram-me-login-switch-race.test.ts` 先复现 **1/3 通过、2/3 按预期失败**：已发起换票的迟到响应写回旧凭据，以及迟到 `wx.login` 回调发出旧换票。修复后 **3/3 通过**，包括切换后的新登录。相邻测试仅运行 `test/miniprogram.test.ts` 的登录／退出／身份切换名称匹配用例 **17/17**，以及 `test/miniprogram-profile-mutation-session.test.ts` **17/17**；TypeScript `tsc --noEmit`、两处 JS `node --check` 和 `git diff --check` 均通过。未运行全量测试，也未在本轮操作微信开发者工具；正式 AppID 真实换票仍待外部资源。
