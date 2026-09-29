# 活动详情与运营聚焦视图（2026-09-30）

以 ZIP 中 `pg01`、`pg05_s`、`pg06`–`pg09`、`_2/_4/_5` 为页面参考，继续复用同一 `pages/event/event` 及既有 R1 权限与接口。测试 AppID `wxbbcab69099026d3f`、本地 API 和合成主办身份 `host`；当前活动 ID `74716b6d-3a87-40b6-91b8-9117fa354bde` 处于招募中但内容审核待定。微信 CLI preview 编译成功，总包 1,776,688 Byte；聚焦测试、原有小程序测试及路由绑定合跑 93/93、类型检查与差异检查通过。

## 截图和点击

- [活动详情](images/caper-event-detail-focused-2026-09-30.png)保留服务端活动事实和分区入口；非详情视图改为独立聚焦画面，顶部返回键可回详情，不在原稿没有的位置显示六分区页签。
- [主办方工作台](images/caper-event-host-focused-2026-09-30.png)的报名、预留、候补和待审数字来自 `GET /events/:id`；成员昵称仅在授权列表有值时显示。场地“已核实”是主办声明，仍要人工确认成局。实际点击“发送公告”进入[公告与问答](images/caper-event-content-focused-2026-09-30.png)，再用左上返回详情。当前没有已审核内容，显示真实空态；提问只在有权限时送现有接口。
- [签到与反馈](images/caper-event-checkin-focused-2026-09-30.png)切换“参与者扫码”和“主办方验码”通过；当前活动尚未成局，动态二维码生成按钮按服务端状态隐藏，页面解释阶段限制。已完成活动的独立反馈沿用既有服务端流程，当前未触发。
- [费用记录](images/caper-event-expense-focused-2026-09-30.png)以 `section=expenseSection` 直达，自动化回读 `loadState=READY`、`expenseLoadState=EMPTY`、`expenses=0`、错误消息为空；该合成活动没有费用账单。费用分摊页仍是双方记录，不是平台支付或收款证明。
- [PG05-S 报名成功视觉](images/caper-event-joined-visual-only-2026-09-30.png)仅用开发者工具临时 `setData` 检查布局。成功卡的真实触发条件仍是服务端回读 `CONFIRMED`；本轮没有发起新报名，不能把视觉注入当成成功报名证据。旧真实成功流程见[此前验收](stitch-r1-terminal-states-2026-09-29.md)。

本轮实际点击主办→公告→详情、签到两模式、成功态视觉卡→活动详情→费用→详情；模拟器异常 0。因本机活动待审且尚未成局，非空公告时间线、真实扫码、非空 AA 账单及真人到场没有在此轮重现；原稿中的照片、地图、支付与人物头像不填合成事实。
