# PG02-N1 通知中心卡片层级（Wave 51，2026-10-01）

## 范围

按用户 Stitch 压缩包的 `pg02_n_1/screen.png` 调整现有通知中心的真实 R1 数据呈现。类别、时间和未读状态移到卡片上方，标题允许完整换行；提醒卡保留现场签到与复制当前地点的两个真实入口，待审批卡保留实时资格决定的“一键通过／查看详情”，规则变更和成局卡继续进入原活动分区。合并了原 WXSS 中重复覆盖的通知中心样式。未更改通知 API、审批逻辑、跳转处理或存储字段。

参考图仅提供视觉目标。现有服务端通知列表返回种类、活动 ID、版本、状态和时间，不提供申请人头像、地图预览、活动相册或费用应付款；界面没有借用参考图的虚构人物、导航、群聊或付款文案。提醒照片仍标注“示意配图”。

## 验证

- 消息/通知相关六个定向测试文件共 **52/52 通过**：`test/miniprogram-message-card-parity.test.ts`、`test/miniprogram-caper-message-parity.test.ts`、`test/miniprogram-message-reminder-venue.test.ts`、`test/miniprogram-messages.test.ts`、`test/miniprogram-messages-hierarchy.test.ts`、`test/message-actions.test.ts`。包含审批资格、通知打开后标已读、账号切换、地点复制前服务端重读和 CTA 路由。
- `node node_modules/typescript/bin/tsc --noEmit` 和本批文件的 `git diff --check` 退出码均为 0；本轮没有运行全量测试。
- 只将 `messages.wxml/.wxss` 同步到 `/private/tmp/caper-r1-e2e-20260930/miniprogram-project/miniprogram/pages/messages/`。微信开发者工具测试 AppID `wxbbcab69099026d3f`、CLI 端口 `21467`、Automator 端口 `9495`；`cli preview` 退出码 0，包体 **2,227,824 Byte**。隔离配置继续指向本机合成 API `127.0.0.1:3037`。
- Automator 用 `caper-message-host-20260930` 打开通知中心，服务端回读 1 条待审批和 1 条站内通知，截图中长活动标题完整显示、两个审批按钮均可见。用 `caper-r1-actor-20260930` 回读并显示 9 条真实合成通知；活动过滤页单独显示匹配的通知。页面异常 **0**，只验证本地模拟器的显示和既有按钮绑定，未逐一点击所有通知。

## 截图

- [历史对照截图（2026-09-30，数据状态不同）](images/caper-final-notice-center-2026-09-30.png)
- [待审批与通知同屏](images/caper-pg02n1-center-all-wave51-2026-10-01.png)
- [活动过滤后的通知](images/caper-pg02n1-center-activity-wave51-2026-10-01.png)
- [九条合成通知的真实密度](images/caper-pg02n1-center-populated-wave51-2026-10-01.png)

历史截图与本次合成身份、条数不同，不能把两图视为逐像素前后对照。参考稿里的申请人身份、地图导航、群入口和支付状态没有 R1 可靠数据或对应接口；正式微信订阅送达、真实账号与真机仍未由本轮验证。
