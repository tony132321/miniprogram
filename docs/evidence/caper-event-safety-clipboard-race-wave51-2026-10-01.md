# 活动安全信息复制：旧回调隔离（2026-10-01）

## 问题与修复

活动详情的“···”原生操作表打开后，切换账号或活动，旧回调仍会调用复制操作；`wx.setClipboardData` 的异步成功/失败回调也会向新页面写入旧操作结果。现在操作表捕获打开时的账号、活动、版本、加载状态和刷新代次，回调只在上下文仍一致时执行；复制前使用当前已加载活动的所属账号校验，复制完成后再次校验上下文，避免旧账号信息或反馈越界。

## 定向证据

- 新增 `test/miniprogram-event-safety-clipboard-race.test.ts`：先运行出现预期的 **4/4 失败**，分别复现切账号、切活动、直接旧页复制和异步反馈污染。
- 修复后运行新测试和 `test/event-caper-navigation.test.ts`：**20/20 通过**。
- 原有活动信息复制用例使用真实加载态的 `event.id` 和 `currentUser` 夹具，单独运行：**1/1 通过**。
- TypeScript `tsc --noEmit`、`node --check miniprogram/pages/event/event.js`：通过。

本证据覆盖本地回调竞态和页面状态约束；不代表真机剪贴板授权或正式环境验收。
