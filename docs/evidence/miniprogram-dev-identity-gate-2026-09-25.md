# 小程序开发身份关闭验证（2026-09-25）

当小程序配置中的 `developmentUser` 为空时，请求层不再读取或发送设备本地遗留的 `devUser`，`X-Dev-User` 请求头保持缺失；“我的”页隐藏测试账号控件，直接调用切换处理器也不会修改本地登录状态。后端生产模式原有的开发身份拒绝仍保留。

`test/miniprogram.test.ts` 模拟本地存储留有旧测试账号、但当前小程序配置已清空开发身份，检查网络请求头和页面处理器。全量 `pnpm test` **173/173**、`pnpm typecheck`、两个改动脚本的语法检查与 `git diff --check` 通过。当前仓库 `miniprogram/config.js` 仍是本机开发配置，正式构建必须替换为真实 HTTPS API 域名并清空 `developmentUser`；这项本地测试不能证明正式微信 AppID、域名白名单或真机登录已通过。
