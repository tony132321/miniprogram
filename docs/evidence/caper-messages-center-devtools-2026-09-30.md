# CAPER 消息与通知中心实点（2026-09-30）

## 范围和环境

以 ZIP 的 `caper_3`、`pg02_n_1`、`pg02_n_2` 为布局参考，在现有消息标签页增加通知中心视图。测试 AppID `wxbbcab69099026d3f`、`DEV_AUTH=1`、合成身份 `host`，API 地址为 `http://127.0.0.1:3000`。原本驻留的旧服务进程对源码已实现的 `GET /me/approval-requests` 返回 `NOT_FOUND`；停止进程、备份合成数据库并用当前源码和原数据库路径重启后，该接口及 `/me/events`、`/me/notifications` 均返回 HTTP 200。

## 点击与回读

1. 微信 CLI preview 编译通过。在开发者工具中打开[消息标签页](images/caper-messages-inbox-live-2026-09-30.png)，点击“通知中心”进入[四分类视图](images/caper-notification-center-live-2026-09-30.png)，点击“活动提醒”“互动消息”筛选并返回消息页；设置按钮进入“我的”现有通知设置入口。
2. 服务重启后重新进入通知中心，自动化回读 `viewMode=CENTER`、`loadState=READY`、`approvalLoadState=READY`、`approvalTotal=0`、`message=''`。返回按钮回到 `INBOX`。当前合成主办账号确实没有通知或待审批报名，截图保留真实空态；没有把设计稿的虚构人物和支付、地图、私聊卡片塞入数据列表。
3. 现有真实通知仍按 `/me/notifications` 分页并支持全部已读和活动深链；审批卡来自 `/me/approval-requests`，通过动作仍请求 `/registrations/:id/approve`。本轮新增通知中心的聚焦测试 19/19、路由与事件绑定 20/20、类型检查和差异检查通过。真实审批卡的模拟器点击属于早前证据，本轮仅验证新视图在空队列时成功加载。

此证据不等于 `pg02_n_1/_2` 逐像素验收。入场凭证需要活动实时签到状态；地图、付款和私聊缺少 R1 服务端契约，界面不声称它们可用。正式小程序配置和真机仍待外部资源。
