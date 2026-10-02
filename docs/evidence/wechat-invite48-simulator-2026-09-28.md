# 邀请活动人工审核：微信开发者工具模拟器回归（2026-09-28）

## 环境与边界

- 微信开发者工具 **RC v2.02.2609231**（arm64）；`wechatide` skill/CLI 0.3.11，状态检查为 `versionRelation=equal`。
- 本机 API `http://127.0.0.1:3000`，`DEV_AUTH=1`，独立测试数据目录 `.data/wechat-invite-review-48-20260928`。身份 `host`、`outsider`、`ops` 均为合成开发身份；活动 ID `6f8e8878-bd66-40e4-a769-ca53743ec790`。邀请 token 未写入证据。
- 这是本机模拟器与隔离 API 的回归。未使用正式 AppID、真实微信登录、真机、合法 HTTPS 域名、订阅消息服务，也未实际发送微信分享或外部提醒。测试期间工作区有其他并行提交；此证据不代表不可变构建或正式微信验收。

## 操作与回读

| 步骤 | 模拟器操作 | 独立 API / 页面回读 |
| --- | --- | --- |
| 首次发布 | HTTP 建立有效 `INVITE` 草稿后，以 `host` 在活动页点击“继续编辑草稿”→“生成发布前预览”→“以上均已核实，最终发布”。 | `GET /events/{id}`：版本 3、`reviewStatus=PENDING`、`recruiting=false`；`GET /ops/events/reviews` 包含此活动。主办方页面显示人工审核提示。 |
| 待审深链 | 以 `outsider` 用**仅含 token** 的 `pages/event/event` 路径打开。 | 页面 `loadState=ERROR`、`event=null`、`inviteSummary=null`，只显示“邀请已失效”；`GET /i/{token}` 返回 404 `NOT_FOUND`，直接 `GET /events/{id}` 返回 403。 |
| 人工批准 | `ops` 对版本 3 调用 `POST /ops/events/{id}/review`，`decision=APPROVED`、附人工核对理由；再以 `outsider` 用同一 token 打开页面。 | 审核接口 200，`reviewStatus=APPROVED`、`recruiting=true`；`GET /i/{token}` 200 并返回原活动摘要；模拟器页面 `READY`、`canJoin=true`。 |
| 报名与分享 | `outsider` 实际点击“本人报名或申请”；仅将 `wx.showModal` **模拟为确认**后提交，随即恢复该 mock。`host` 通过页面运行时调用 `prepareShare` 方法；随后确认“主动分享邀请卡”按钮已渲染，**没有点击微信分享按钮**。 | 报名页显示 `CONFIRMED`，`GET /me/registrations` 为 `CONFIRMED`、接受版本 3；`GET /events/{id}/share-metrics` 为 `shareIntents=1`。这里验证的是分享准备与意图记录，不能证明消息已发送、送达或阅读。 |
| 再编辑待审 | `host` 实际点击“编辑活动规则并预览变更”，修改标题为“邀请审核合成羽毛球新版未审”，点击预览及“上述差异已核实，最终确认变更”。 | 预览仅含标题差异；活动版本 4、`reviewStatus=PENDING`、`recruiting=false`。`GET /i/{token}` 再次 404；待审分享意图接口返回 409 `REVIEW_PENDING`；未知成员直接读取返回 403。 |
| 已报名成员安全路径 | 原 `outsider` 现为已报名成员，用 `id+token` 打开活动页（token 已失效时按已知活动 ID 回退）。实际点击“退出报名”。之后在“我的与通知”页输入活动 ID 与合成安全问题，通过页面 `report` 方法提交。 | 页面 `READY`，版本 4、`visibleContentVersion=3`，显示原已审核标题，未显示新版标题；`canJoin=false`，退出按钮仍在。退出后 `GET /me/registrations` 为 `CANCELLED`；`GET /me/reports` 有该活动的 `SAFETY/OPEN` 工单。举报通过页面方法提交，并非按钮点击证据。 |
| PG02 提醒状态 | 已报名身份打开“我的与通知”。 | 页面通知的 `external_status=CONSENT_WITHDRAWN`，显示“未开通外部提醒”；只证明状态文案，本次没有开通或发送外部提醒。 |

## 截图

- [主办方待审页面](wechat-invite48-host-pending-2026-09-28.jpg)
- [待审 token-only 页面无活动内容](wechat-invite48-token-pending-2026-09-28.jpg)
- [批准后成员已报名](wechat-invite48-approved-joined-2026-09-28.jpg)
- [再编辑待审时成员看到已审核版本与退出入口](wechat-invite48-member-approved-snapshot-2026-09-28.jpg)
- [PG02 外部提醒状态文案](wechat-invite48-notification-status-2026-09-28.jpg)

本次未验证真实微信账号权限、真机网络与系统分享、外部服务送达、正式运营审核流程或正式发布包。
