# T07 协办权限本地验证（2026-09-26）

## 实现与边界

- 复用活动详情页、活动事务锁、现有幂等及审计机制。迁移 26 持久化每场、每名协办的能力集合、到期和撤权时间。主办方可授予或撤回 `APPROVE_REGISTRATION`、`MANAGE_ANNOUNCEMENTS`、`CHECKIN_MANAGE`；执行层每次读取当前授权。协办不能借此获得主办方的活动编辑、费用或结项权。
- 仅签到管理权限的协办只读取已确认参与者以申请人工补记；审批权限才可读取完整报名列表。自己的报名、退出及签到与管理权限分开。
- 本次是 T07 `AC-COHOST-REVOKE` 的本地验证。独立的用途授权与排队通知撤权验收仍分别核对。

## 自动化结果

在仓库根目录运行 `PATH=/Users/tsb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm test`：275/275 通过；`pnpm typecheck` 通过；`git diff --check` 通过。相关测试覆盖能力隔离、跨活动拒绝、授权期限、幂等审计、旧 bearer 会话撤权、本人签到保留，以及小程序授权/撤权载荷和状态。

## 微信开发者工具模拟器

使用本机更新后的微信开发者工具和 `wechatide` 0.3.11，本地开发身份及 API；测试活动 `9de97aa2-5383-455a-a9be-d297e5e2269c`，主办 `host`，申请者 `helper`。主办在现有详情页选中签到管理并授予 `helper`，页面读回有效授权；点击撤回、在确认框确认后，页面读回 `REVOKED`。将本地身份切换为 `helper`，重新打开同一活动，页面数据 `canApproveRegistration=false`、`canManageCheckins=false`、`canManageAnnouncements=false`。这是开发身份与模拟器证据，不是正式微信身份或真机验收。

截图：[授权后控件](cohost-grant-controls-2026-09-26.jpg)、[撤回确认](cohost-revoke-modal-2026-09-26.jpg)、[撤回后控件](cohost-revoked-controls-2026-09-26.jpg)。

正式 AppID、HTTPS API、真实用户及真机尚未提供，正式会话与目标 PostgreSQL 部署需另行验证。开发包的发布闸门不能凭这些本地结果判定通过。
