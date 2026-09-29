# CAPER 活动聚焦页原稿对照（2026-09-30）

对照用户 ZIP 的 `pg01`、`_2`、`_4`、`_5`、`pg06`、`pg07`、`pg08`、`pg09`，沿用原有活动页和 API 绑定调整 WXML/WXSS。测试使用微信开发者工具测试 AppID、隔离小程序副本（只将 API 改为 `127.0.0.1:3037`）、合成活动与身份；主工程 CLI `preview` 在本轮工作区编译退出码 0，总包 1,842,066 Byte。隔离场景的活动与 AA 账本由[三状态业务 API 种子](caper-three-state-isolated-devtools-2026-09-30.md)建立。

| 聚焦页 | 开发者工具回读和视觉 | 截图 |
| --- | --- | --- |
| 详情 `pg01/_2/_4` | `loadState=READY`。按真实活动类型／状态展示蓝色或羽毛球照片海报，已确认席位、时间和场地事实前置，主按钮进入当前报名分区。合成活动没有羽毛球类型，因此图中为蓝色海报；代理另做临时 `setData` 的照片态视觉检查，未计业务验收。 | [真实合成详情](images/caper-event-parity-details-2026-09-30.png) |
| 主办 `_5/pg06` | `activeSection=hostSection`、`loadState=READY`，四项统计来自服务端当前活动：已确认 5、预留 0、候补 0、待审核 0；主办动作仍受当前活动版本、审核与权限保护。 | [真实主办工作台](images/caper-event-parity-host-2026-09-30.png) |
| 公告 `pg07` | `activeSection=contentSection`、`loadState=READY`，本场无已审核公告；收紧空态和事实问答卡，底部真实提问入口保留。此次未构造非空公告时间线。 | [真实空态](images/caper-event-parity-content-2026-09-30.png) |
| 签到 `pg08` | `activeSection=checkinSection`、`loadState=READY`。成员视图提供扫码／手输；代理实点主办切换后 `checkInMode=host`，动态码入口保持原有业务门控。此次未点击生成动态码或真机扫码。 | [参与者视图](images/caper-event-parity-checkin-2026-09-30.png)、[主办验码视图](images/caper-event-parity-host-qr-2026-09-30.png) |
| AA `pg09` | `activeSection=expenseSection`、`expenseLoadState=READY`；当前账本 1 本、5 条服务端授权分摊、总额 10001 分。实点明细／展开后 `visibleShares=5`，UI 显示 ¥100.01；`RECORD_ONLY` 改为“仅作记录”文案，不暗示已付款。 | [账本](images/caper-event-parity-expense-2026-09-30.png)、[展开明细](images/caper-event-parity-expense-expanded-2026-09-30.png) |

代理的活动页定向测试 111/111、类型检查与差异检查通过；主代理另重跑活动相关 20/20、类型检查、差异检查和主工程 CLI `preview`。本轮页面只调整布局与文本层次，不变更活动服务端契约。所有实测聚焦页小程序异常数为 0。

原稿中的场地地图、用户照片／头像、临时群聊、离线签到凭证、商户收据和平台支付没有 R1 已验证数据或接口；界面没有把视觉示意当作真实能力。真实动态二维码生成、非空公告与真机摄像头仍需另行验收。
