# CAPER wave9–13 合并候选聚焦验收（2026-09-30）

本轮在现有 R1 工程上合并：首页状态捷径、重大变更通知重新确认入口、本人活动时间／城市安全摘要、RQ05 邀请二维码与扫码、PG11-C 私聊关闭态，以及 `/me/events` 有界分页和 schema 67 索引。各条隔离模拟器点击和 API 回读分别见 [首页／消息](caper-home-message-actions-wave9-2026-09-30.md)、[行程摘要](caper-safe-summaries-wave10-2026-09-30.md)、[邀请 QR](caper-invite-qr-wave11-2026-09-30.md)、[私聊关闭态](caper-private-chat-closed-wave12-2026-09-30.md)；分页与 PostgreSQL 恢复见[单独记录](me-events-bounded-pagination-wave13-2026-09-30.md)。

将受影响的 14 个测试文件在同一当前工作树下聚焦运行：**102/102 通过、0 失败**，包括消息、首页、活动、发现、邀请、行程、本人活动分页和迁移。`pnpm typecheck`、`git diff --check` 通过。微信开发者工具主 CLI 曾因既有 HTTP 端口监听但不响应而初始化超时；终止并重启其主进程后，对当前源码运行 `cli preview --project /Users/tsb/Documents/小程序 --port 21467` 退出码 0，总包 **2,158,710 Byte**。重启后主工程模拟器首页 `READY`；隔离副本仅把开发 API 改为 `127.0.0.1:3037`，同步当前小程序源码后以合成身份打开最新版首页，`READY`、本人活动 3 条、页面异常 0。两种环境均使用测试 AppID `wxbbcab69099026d3f`。

按用户要求未运行全量本机测试。此记录不是最新提交的 GitHub CI 通过、39 屏逐像素验收、真机、正式 AppID／域名／订阅送达或三场真人活动的证据。
