# CAPER R1 界面整合与开发者工具复验（2026-09-30）

## 候选与边界

本轮在现有 Project IRL R1 工程上继续集成 ZIP 的 CAPER 页面，源码候选为 GitHub `codex/r1-implementation` 的 `ae48ce2`。小程序使用微信开发者工具测试 AppID `wxbbcab69099026d3f`、本机 API 与隔离的合成账号／活动，不含正式微信账号、合法 HTTPS 域名或真实活动。ZIP 的 39 张设计图是视觉参照；一个小程序路由承载多个设计状态。设计中的私聊、公开发现、真实 AI、相册、支付和永久离线签到码仍未具备 R1 服务端能力，不以假数据模拟已上线功能。

## 代码与模拟器结果

| 页面／动作 | 本轮可复查结果 | 截图 |
| --- | --- | --- |
| 首页→发起 | 主工程首页 `READY`，读回本人活动 2 条；点击主入口进入发起 IDEA，页面异常 0。 | [首页](images/caper-final-home-2026-09-30.png) |
| 城市独立打开→返回 | `reLaunch` 直接以城市页作为根路由后点击返回，实际回到首页；异常 0。城市选取在有导航栈与无导航栈时另有定向回归。 | 仅路由读回 |
| 消息→通知中心 | 隔离服务返回 7 条真实站内通知、2 条未读；消息页把真实分组放在关闭态私聊卡之前，点击通知中心看到 7 张卡，异常 0。 | [消息页](images/caper-final-messages-inbox-2026-09-30.png)、[通知中心](images/caper-final-notice-center-2026-09-30.png) |
| 活动提醒卡 | 用 `miniprogram-automator page.setData` 注入一条**仅用于排版**的 `EVENT_REMINDER`；配图和“示意配图”标签实际渲染，异常 0。未在服务端生成提醒，不能证明送达。 | [视觉样本](images/caper-reminder-visual-only-2026-09-30.png) |
| 通知成局→活动详情 | 点击真实成局通知进入对应活动 `detailsSection`；服务端回读通知状态 `OPENED`，异常 0。 | [活动详情](images/caper-final-milestone-detail-2026-09-30.png) |
| 个人页 | 合成账号显示 7 条中文通知、本人活动 3 场／主办 1 场／已确认 3 场；私有区与失败状态独立处理，异常 0。 | [个人页](images/caper-final-profile-2026-09-30.png) |
| PG07 公告问答 | 隔离业务接口实际提交成员问题、主办公告、主办回答，并由合成运营身份审核；点击“回复此问题”进入回复表单。已审核内容形成作者／时间／回复层级，技术 ID 不作为昵称显示，异常 0。 | [非空时间线](images/caper-final-pg07-timeline-2026-09-30.png) |
| PG06 主办与成员 | 真实合成主办活动显示 5 个已确认席位；“查看全部”进入报名区，5 张确认成员卡来自服务端名单，未授权昵称以“参与者 N”显示。AI 助手保持未开放提示，异常 0。 | [工作台](images/caper-final-host-workbench-2026-09-30.png)、[成员区](images/caper-final-registration-roster-2026-09-30.png) |
| PG08 签到 | 该合成活动尚未到签到窗口，页面显示 10 月 2 日 06:06 开放且不生成主办方动态码；蓝底照片与白卡比例已重排，异常 0。先前的动态签到业务路径见既有 E5 证据。 | [锁定态](images/caper-final-pg08-checkin-2026-09-30.png) |
| PG09 费用 | 主办打开真实合成 AA 账本并实点展开 5 行；本人份额和匿名成员标签可读，不显示技术 ID，异常 0。 | [非空账本](images/caper-final-pg09-expense-2026-09-30.png) |
| PG06-S 分享 | 审核通过且有资格的合成主办活动打开邀请弹层；4 个动作与类型对应示意图可见，点击准备分享后服务端生成分享来源令牌，异常 0。原生微信接收与真实送达尚未验收。 | [打开](images/caper-final-share-sheet-2026-09-30.png)、[准备后](images/caper-final-share-prepared-2026-09-30.png) |

## 工程检查

- `pnpm typecheck` 退出码 0；`git diff --check` 退出码 0。
- 微信开发者工具 CLI `preview` 退出码 0，总包 **2,049,919 Byte**，使用测试 AppID。此项证明当前源码可被开发者工具编译，不等于真机验收。
- 全量 `pnpm test` **822/822** 通过（耗时约 264 秒）；源码提交 `ae48ce2` 对应 [GitHub R1 CI run 96](https://github.com/tony132321/miniprogram/actions/runs/36655409528) 最终为 **success**。
- 隔离开发者工具从 `app.json` 逐条 `reLaunch` **20/20** 个已注册主包和分包路由；每条打开后实际 `page.path` 与注册路径相同，捕获异常 0。此为路由打开检查，不替代各页按钮点击与业务验收。
- `pnpm preflight:candidate` 返回 `BLOCKED / RECEIPT_MISSING`：当前没有独立的 UAT 候选回执。该闸门只做结构一致性检查，不授予发布资格。
- 当前 macOS 自动化的原生窗口通道因锁屏不可读取；上述微信页面截图和点击均来自开发者工具 CLI／`miniprogram-automator`，不是原生 Computer Use 的窗口观察。

## 尚未取得的验收

这些截图覆盖本轮重点状态，并非 39 屏逐像素同尺寸测量，也不是每一个按钮逐项真机实点。R1 关闭能力维持明确的不可用说明；正式 AppID、HTTPS 合法域名、订阅消息模板、真机、真人运营值守及三场受控活动仍缺外部资源。原生微信分享接收、扫码摄像头、订阅通知送达和正式环境性能须在这些资源到位后单独验收。
