# CAPER 三状态隔离开发者工具实点（2026-09-30）

本轮在微信开发者工具测试 AppID `wxbbcab69099026d3f` 中，用 `cli auto` 运行隔离小程序副本，副本仅把 API 地址改为本机 `http://127.0.0.1:3037`；源码来自当前 CAPER 工作区。隔离服务使用 `DEV_AUTH=1`、合成身份 `caper-r1-actor-20260930` 和独立数据目录。数据由业务 HTTP 接口创建并回读，种子脚本及 40 次成功请求记录留于 `/private/tmp/caper-r1-e2e-20260930/`。以下仅证明测试 AppID、模拟器、本机服务上的链路。

| 设计状态 | 实际点击与回读 | 截图 |
| --- | --- | --- |
| `pg02_b` 候补 | 首页“待确认”出现真实 `OFFERED` 卡，点击主动作进入“我的”通知区；有效通知 `actionable=true`。在通知中实点“主动确认补位”，页面提示成功；随后 `GET /me/registrations` 回读该报名为 `CONFIRMED`，通知刷新后 `actionable=false`、`declinable=false`。 | [候补卡](images/caper-pg02b-offered-card-2026-09-30.png)、[通知定位](images/caper-pg02b-notice-focus-2026-09-30.png)、[确认后](images/caper-pg02b-offer-accepted-2026-09-30.png) |
| `pg02_d` 历史 | 首页“历史”页签出现真实 `CANCELLED` 活动卡，主动作“查看活动记录”、次动作“查看 AA 记录”；实点次动作进入同活动 `expenseSection`。 | [历史卡](images/caper-pg02d-history-card-2026-09-30.png)、[成员 AA](images/caper-pg02d-member-aa-2026-09-30.png) |
| `pg09` 主办非空 AA | 主办活动 `expenseSection` 从 `GET /events/:id/expenses` 读取当前 1 本账，共 5 条获授权分摊、总额 10001 分；实点“查看明细”、金额排序及“展开成员”，页面回读 `detailsOpen=true`、`sortByAmount=true`、`membersExpanded=true`、`visibleShares=5`，显示 ¥100.01。 | [五行账本展开](images/caper-pg09-five-row-expanded-2026-09-30.png) |

历史活动的成员身份只从费用 API 获得自己的 1 条分摊，页面标“我的份额”，没有排序按钮；服务端回读同为 1 条、2001 分。没有把这 1 条当作整场人数。主办页的“已处理”与“已收到”只是双方记录声明，并非支付凭证。

测试使用合成活动、合成账号和模拟器，截图中的人物与场景图是设计示意；不构成正式 AppID、HTTPS、真实订阅消息送达、真机、真人值守或三场活动验收。当前隔离副本仍在 `/private/tmp`，提交代码只包含截图与证据说明，不包含该临时测试库。
