# 第 47 版 PG10 删除申请保护：微信开发者工具模拟器与 HTTP 回读

日期：2026-09-27。验证时使用第 47 版候选代码树，随后提交为 `e9f9be7`。微信开发者工具 `wechatide` 0.3.11、测试 AppID、本机 `http://127.0.0.1:3000` API、`DEV_AUTH=1`、隔离 PGlite 目录 `.data/wechat-privacy-delete-47-20260927`。本轮未改产品代码，也未上传或发布。

## 合成前置条件

- 在隔离库建立 `host`、`privacy_member` 两个合成用户；通过本机 HTTP 创建并发布邀请制合成活动 `79d409ca-e4db-4d2b-a013-21c8b529420f`，`privacy_member` 自主报名为 `CONFIRMED`，并开启活动提醒及类似活动候选授权、设置活动内昵称。申请前 HTTP 回读：两项授权均为 `true`，主办方的候选名单含 `privacy_member`，昵称列表含 1 项。
- 为检验结项后的候选名单，只在隔离库中把活动状态设为 `COMPLETED`；这不是自然到期、实际举办或结项操作的证据。另在隔离库加入一条合成 `REGISTRATION_STATUS` 待发送通知与到期 `SEND_EXTERNAL` 任务，用于验证申请后的发送挡板；没有连接真实通知服务商。

## 真实模拟器交互

1. 使用 `simulator_open_page` 编译并打开 `pages/me/me`。在页面可见的“本地测试账号”输入框用 `automation_element_action input` 输入 `privacy_member`，再对 `#switchDevUserButton` 执行 `tap`。运行时页面回读 `devUser=privacy_member`、`loadState=READY`、活动提醒与再约授权均为 `true`。这是开发身份，页面 `hasSession=false`，**不是**正式微信登录。
2. 确认页面确有 `button[data-kind="DELETE"]` 后，对这个可见按钮执行 `automation_element_action tap`。这是按钮点击，不是页面方法调用或直接 API 代替。
3. 运行时页面 `privacy` 列表新增一条 `DELETE · PROTECTED_PENDING_POLICY`，`protection.state=APPLIED`、`consentWithdrawals=2`、`aliasesRemoved=1`；页面 `message` 和列表 `notice` 均明确说明“尚未停用账号、删除资料或去标识”。两项开关回读均为 `false`。[页面回执截图](wechat-delete-protection-pg10-2026-09-27.jpg)、[请求行截图](wechat-delete-protection-request-row-2026-09-27.jpg)。

## 独立 HTTP 回读

- `privacy_member` 的 `GET /privacy/requests` 返回同一条 `PROTECTED_PENDING_POLICY` 请求，保护状态 `APPLIED`、撤回授权数 2、移除昵称数 1，并保留未删除说明；`other_member` 的同一路径返回空列表。
- 申请后的 `GET /me/consents`、`GET /me/similar-invites` 均为 `false`；主办方 `GET /events/{id}/repeat-candidates` 与 `GET /events/{id}/aliases` 均从申请前的 1 项变成空列表。以 `privacy_member` 再尝试开启两项授权或设置新昵称，三个 POST 均返回 HTTP 409、`DELETE_REQUEST_PENDING`。
- 合成 `SEND_EXTERNAL` 任务由本机 API 的后台 worker 处理后，`GET /me/notifications?offset=0` 读到对应 `REGISTRATION_STATUS` 的 `external_status=DELETE_REQUEST_PENDING`。这证明本地挡板状态；没有真实服务商发送或拒绝回执。

`PROTECTED_PENDING_POLICY` 仅表示申请受理后的即时保护。正式微信身份、HTTPS 合法域名、真机、真实外部通知、法律批准的保留期限、实际停用/删除/去标识和备份处理，均未在此验证。
