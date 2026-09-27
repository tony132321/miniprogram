# 微信开发者工具验收记录（2026-09-24）

环境：微信开发者工具 macOS，本机小程序测试号 `wxbbcab69099026d3f`，本地 API `127.0.0.1:3000`，开发身份模式和 PGlite。测试号仅用于开发；服务端微信 `code` 交换、订阅消息和正式域名未配置。本记录是模拟器运行结果，不是真机或发布验收。

| 用例 | 实际操作及结果 | 证据 |
| --- | --- | --- |
| 创建与发布 | 在“发起”活动页填羽毛球、深圳、公共球馆、日期、人数与费用；生成逐项预览后确认发布。活动进入 `RECRUITING`，版本 2。 | [发布预览](wechat-preview.jpg) |
| 邀请与报名 | 使用邀请 token 从不同开发身份进入；5 人确认，1 人候补。主办方确认成局。 | API 状态及小程序活动详情，自动化记录在本地测试会话 |
| 候补补位 | 一位参与者退出后，候补获得 15 分钟 `WAITLIST_OFFER`；在“我的”主动接受，状态变为 `CONFIRMED`。已接受的通知不再出现可执行按钮。 | API 状态及小程序“我的”页面 |
| 重大变更 | 主办方将公共球馆名称变更，活动版本增至 3，原参与者进入 `RECONFIRM_REQUIRED`；页面展示旧值、新值与截止时间。主办方未本人重确认时确认成局被拒绝；全部重确认后成局。 | [重确认页面](wechat-reconfirm.jpg) |
| 多字段活动变更 | 从已发布活动进入完整编辑表单，将日期、公共球馆和费用上限一起修改；预览显示 6 项旧值/新值及受影响 2 人。最终确认后版本由 2 增为 3，招募暂停，两位原确认者进入 `RECONFIRM_REQUIRED`。 | [变更预览](wechat-change-preview.jpg)、服务端状态 |
| 动态二维码 | 用测试时钟 `2026-10-01T12:05:10Z` 将活动置于签到窗，主办方展示签名口令二维码。独立条码解码得到与页面口令相同的值。 | [二维码页面](wechat-qr.jpg) |
| 模拟扫码 | 使用开发者工具的 `scanCode` mock 返回上一步二维码内容，参与者页面执行扫码，服务端与页面均出现 `SCAN` 签到证据。此用例只验证扫码回调后的业务链路；未验证物理摄像头。 | [签到记录](wechat-scan-attendance.jpg) |
| 规则降级草稿 | 输入“本周六晚上8点在深圳打羽毛球，六个人，AA每人五十元”，页面得到 2026-09-26 20:00、城市、人数和费用，分别标注“来自原话”或“模板默认”，并列出待确认字段。 | [规则降级页面](wechat-ai-fallback.jpg) |
| 活动事实问答 | 参与者问“活动几点开始”，收到当前版本 3 的 2026-10-01 20:00；问“需要自带球拍吗”，收到“尚未确认”。运营人工审核问题后，主办方页面出现 `OPEN` 待办；主办方提交回答，运营审核回答后待办转为 `RESOLVED`。未审核的问题不会向主办方展示。 | 小程序页面运行数据、API 审核结果与 `test/collaboration.test.ts` |
| 本人数据导出 | 参与者在“我的”执行复制本人数据 JSON；API 仅返回该身份所属记录，跨账号隔离由自动化测试验证。大数据量仍转人工导出请求。 | [个人页结果](wechat-privacy-export.jpg)、`test/api.test.ts` |
| 活动内昵称 | 参与者主动填写“周末球友甲”，活动页只显示获同意昵称和本人标记；撤回后列表立即清空。旧活动数据升级第二版迁移后仍可读取。 | [设置后的活动页](wechat-event-alias.jpg)、`test/event-aliases.test.ts` |
| 风险暂停与解除 | 运营在本地测试环境暂停一场已发布活动；开发者工具活动页实际显示暂停提示，页面数据 `riskPaused=true`，未包含私密核查原因。解除后调用页面刷新，`riskPaused=false`；服务端阻断和权限由 `test/safety.test.ts` 验证。 | [暂停时活动页](wechat-safety-hold.jpg) |
| 公开活动人工审核 | 用独立 PGlite 测试库发布 `PUBLIC`、逐人审批活动，页面 data 为 `reviewStatus=PENDING`、`recruiting=false`，外部读取被拒绝。运营核对事实并通过后，页面 data 为 `APPROVED`、`recruiting=true`，新报名进入 `REQUESTED`。主办方修改标题后，页面再次显示待审；外部读取为 403，旧版本审核为 409。 | [审核通过页面](wechat-public-review-approved.jpg)、[重新待审页面](wechat-public-review-pending.jpg)、`test/event-review.test.ts` |
| 公开招募总开关通知（9 月 25 日补测） | 本地 API 审核一场公开活动后关闭招募；后台任务生成站内通知，模拟器“我的”页显示“公开活动招募已暂停”。点击通知后服务端记录 `OPENED`，运行时进入对应活动详情且 `riskPaused=true`。 | [通知页面](wechat-public-gate-notice.jpg)、[暂停活动详情](wechat-public-gate-paused.jpg)、`test/public-gate.test.ts` |

中途一次模拟器刷新后，页面运行时路由与画面不同步，`automation_page_action` 超时；调试日志显示开发者工具 `routeDone with a webviewId ... is not found`。单次刷新后运行时与画面恢复一致，之后完成扫码和草稿验证。未据此认定业务代码异常；真机验收仍需独立执行。

新增第 4 版数据库迁移后，使用原有本地数据重启 API，再在开发者工具现有活动页执行 `refresh`，页面 data 仍能读取原活动版本 3、人数统计和 `riskPaused=false`。限流并发与 HTTP 429 行为以 `test/rate-limits.test.ts` 验证；本次未把模拟器交互当作实际抗压测试。

公开审核验收使用独立 `.data/review-smoke`。默认 `.data/pgdata` 曾保存开发期间旧稿的第 4 版迁移校验值；旧库已原样移至 `.data/pgdata-legacy-migration4-20260924`，新默认库启动后 `/health` 返回 `ok`。首次截图调用因开发者工具 `APPID_ERROR` 失败，随后导航、页面运行数据读取和两张截图成功。以上是模拟器与本地 API 证据，正式身份与真机仍未验证。

源码验证：`pnpm test`、`pnpm typecheck` 和小程序 JavaScript 语法检查；具体最新结果以仓库测试运行输出为准。真实微信登录、订阅消息、HTTPS 服务、真实 PostgreSQL 多连接、真机相机扫码及三场受控活动均未验收。
