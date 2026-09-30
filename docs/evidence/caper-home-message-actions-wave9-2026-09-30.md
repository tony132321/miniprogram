# CAPER 首页状态捷径与规则变更通知实点（2026-09-30）

本轮复用现有 `/me/events`、报名／签到／结项和站内通知接口，只为 ZIP 的 `pg02_b`、`pg02_c`、`pg02_d` 与 `pg02_n_2` 补齐状态卡和通知卡的真实入口。测试使用微信开发者工具测试 AppID `wxbbcab69099026d3f`、自动化端口 `9493`、隔离小程序副本、`DEV_AUTH=1` 的本机 API `127.0.0.1:3037` 和隔离 PGlite 数据。活动和身份均为合成数据。

| 实点动作 | 当前模拟器与服务端证据 |
| --- | --- |
| 首页“我组织的”已成局活动卡→签到捷径 | 合成主办身份 `caper-r1-actor-20260930` 选择本人已成局活动，进入同一活动的 `checkinSection`，`checkInMode=host`，页面异常 0。[主办状态卡](images/caper-home-wave9-host-shortcut-2026-09-30.png) |
| 首页“待确认”待审活动卡→报名处理 | 合成报名者 `caper-wave9-pending-20260930` 的服务端报名状态为 `REQUESTED`；卡片进入同一活动的 `registrationSection`，可见真实退出入口，页面异常 0。[待确认状态卡](images/caper-home-wave9-pending-shortcut-2026-09-30.png) |
| 通知中心“活动规则已更新”→查看最新安排 | 另一场合成活动经业务 API 发布、运营审核、成员报名、重大场地变更和复审后，服务端生成真实 `MATERIAL_CHANGE` 通知。模拟器卡片进入同一活动的 `registrationSection`，成员报名状态 `RECONFIRM_REQUIRED`、重新确认数据 `READY`；服务端回读通知状态 `OPENED`，页面异常 0。[规则变更通知](images/caper-message-wave9-material-center-2026-09-30.png) · [重新确认入口](images/caper-message-wave9-reconfirm-entry-2026-09-30.png) |

通知卡片在当前已加载列表和当前身份匹配后才允许跳转或标记已读；加载更多、刷新和全部已读的晚到响应不能把旧身份数据写回。事件页对主办签到和成员结项反馈入口重新核对服务端状态与权限。规则变更的截止时间和时间类差异显示为北京时间，避免向用户展示原始 ISO 时间串。

验证范围：相关五个测试文件 **61/61**，`pnpm typecheck`、`git diff --check` 通过；隔离开发者工具上述三条实际点击与服务端回读通过。按用户要求未启动全量测试。本记录不证明 39 屏逐像素一致、正式微信登录、真实订阅送达、真机扫码、真人运营或三场活动验收。
