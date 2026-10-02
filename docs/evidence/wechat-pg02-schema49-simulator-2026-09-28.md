# PG02 通知状态与打开顺序：微信模拟器回归（2026-09-28）

- **构建**：主工作树提交 `f174434`；微信开发者工具 RC v2.02.2609231（arm64），`wechatide` 0.3.11。
- **隔离环境**：本机 `DEV_AUTH=1` API（`127.0.0.1:3000`），独立 PGlite 数据目录 `.data/wechat-pg02-schema49-20260928-run1`，合成用户 `pg02_member`。通过业务模块建立已审核邀请活动并报名，产生 `REGISTRATION_STATUS` 通知；调用当前通知派发逻辑，但未连接外部提供方。活动 ID `1ab109bc-3498-473f-b6ab-b351cbee85cb`，通知 ID `b8f1eebf-7302-4927-8554-31064c63145d`。

| 检查 | 实际操作与结果 |
| --- | --- |
| 未配置用途文案 | 独立 `GET /me/notifications?offset=0` 初始返回 `external_status=PURPOSE_NOT_CONFIGURED`、`external_failure_code=PURPOSE_NOT_CONFIGURED`、`read_at=null`。模拟器切换到 `pg02_member`，打开 `pages/me/me`，通知页运行时 `externalStatusLabel=未开通外部提醒，请查看站内通知`；截图中显示相同文案与 `IN_APP`。 |
| 导航失败不标已读 | 在**模拟器运行时**暂时把 `wx.navigateTo` 替换为调用传入的 `fail` 回调（错误 `navigateTo:fail synthetic regression`）。实际点击页面的“查看通知并标记已打开”按钮；页面显示该错误，随后独立 API 回读仍为 `IN_APP`、`read_at=null`。立即恢复原 `wx.navigateTo` 函数，并确认恢复成功。 |
| 正常导航才标已读 | 再次实际点击**同一按钮**。模拟器当前页变为 `pages/event/event?id=1ab109bc-3498-473f-b6ab-b351cbee85cb`，详情 `loadState=READY`。随后独立 API 回读为 `status=OPENED`、`read_at=2026-09-27T16:58:13.445Z`，外部状态仍为 `PURPOSE_NOT_CONFIGURED`；返回 PG02 后页面显示 `OPENED`。 |

截图：[初始未读与文案](wechat-pg02-schema49-unconfigured-unread-2026-09-28.jpg) · [导航失败仍未读](wechat-pg02-schema49-navigation-failed-unread-2026-09-28.jpg) · [成功进入活动详情](wechat-pg02-schema49-notice-detail-opened-2026-09-28.jpg) · [返回 PG02 后已打开](wechat-pg02-schema49-opened-status-2026-09-28.jpg)。

这是合成身份、本机 API 与微信开发者工具模拟器的证据；未验证真机、正式 AppID、HTTPS 合法域名或微信外部订阅消息发送与送达。
