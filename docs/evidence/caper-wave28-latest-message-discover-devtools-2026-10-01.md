# 最新消息与发现页开发者工具定向复拍（Wave 28，2026-10-01）

本轮小程序源码来自本地 `52bb49d`；此后仅提交了服务端事件代码 `30cdf65`，两次提交的 `miniprogram/` Git 树均为 `1d174ee3858911f27c22f594c1eb76a6b5b35cec`。用 `rsync -a --delete --exclude=config.js --exclude=.DS_Store miniprogram/ /private/tmp/caper-r1-e2e-20260930/miniprogram-project/miniprogram/` 同步完整小程序后，`diff -qr` 排除这两项退出码为 0。隔离配置 `config.js` 的 SHA-256 仍是 `1f2737bf6580082d82ccf378071d1436b4c2d17f536a3fc539fe88a1c1ae0455`，指向本机合成 API `http://127.0.0.1:3037`。微信开发者工具使用测试 AppID `wxbbcab69099026d3f`、CLI 端口 `21467`、自动化端口 `9495`；`cli preview --project /private/tmp/caper-r1-e2e-20260930/miniprogram-project --port 21467` 退出 0，总包 **2,138,998 Byte**。没有使用正式账号、HTTPS 域名或真实人员数据。

| 范围 | 在模拟器实际操作与读数 | 画面 |
| --- | --- | --- |
| 消息首页 | 合成主办身份进入 `pages/messages/messages`，加载 `READY`，顶部实际渲染“全部消息／👥 活动相关／📢 系统通知”**3** 项；依次点击后页面筛选读数为 `ACTIVITY`、`SYSTEM`、`ALL`。当前账号有 1 条真实站内通知。 | [三筛选首页](images/caper-wave28-messages-three-filters-2026-10-01.png) |
| 通知中心与个人页审批入口 | 从消息首页点击“通知中心”，渲染“全部／活动提醒／互动消息／系统通知”**4** 项，点击“互动消息”显示服务端合成待审批 **1** 条。返回首页恢复 `INBOX/ALL`。随后在“我的”页实际点击“报名管理”，进入同一消息路由 `CENTER/INTERACTION`，待审批仍为 1；点击返回再次恢复 `INBOX/ALL`。未点击“一键通过”，未改变报名状态。 | [中心互动消息](images/caper-wave28-message-center-interaction-2026-10-01.png) · [个人页审批聚焦](images/caper-wave28-profile-approval-focus-2026-10-01.png) |
| 发现页首屏顺序 | `pages/discover/discover` 渲染 **10** 个分类按钮、**4** 张双列摄影灵感卡。自动化读到分类 `top=103`、四卡网格 `top=148`、公开找局关闭说明和邀请码入口 `top=787`，与分类→四卡→说明/入口的顺序一致。点击非“全部”分类显示关闭提示；点击“全部”清除提示。 | [四卡首屏](images/caper-wave28-discover-photo-first-2026-10-01.png) · [四卡尾部与邀请码入口](images/caper-wave28-discover-cards-to-invite-strip-2026-10-01.png) |
| 摄影卡与邀请入口 | 实际点击首张灵感卡并给出自动化“继续浏览”弹窗回调，留在发现页；实际点击第二张并给出自动化“发起羽毛球”回调，进入真实 `pages/create/create`。返回发现页后点击“输入邀请口令”，页面滚到邀请表单，`scrollTop=1937`；未输入或使用有效邀请码。 | [邀请表单落点](images/caper-wave28-discover-invite-jump-2026-10-01.png) |

消息和发现定向脚本捕获小程序 `exception` **0**。自动化 `tap()` 返回早于页面 `setData` 时，等待筛选状态改变后读数正确。微信开发者工具自动化接口的 `native().confirmModal()` 在本机此次未触发发现卡跳转；用 `mockWxMethod('showModal', { confirm: true })` 给出弹窗确认回调后，**卡片仍由自动化实际点击**，进入发起页。由此只能证明卡片处理函数和确认分支的模拟器跳转，不能声称原生弹窗按钮已实点。脚本位于 `/private/tmp/project-irl-automator/caper-wave28-message-discover-latest-20261001.cjs`；没有运行全量测试或真机检查。

最后将模拟器切到 `caper-r1-actor-20260930` 合成身份并停留在发现页顶部。该身份的 `/me/events` 页面状态为 `READY`，读到本人活动 **3** 条、灵感卡 **4** 张，便于在微信开发者工具继续人工检查。上述截图均为 580 × 1260 px 的开发者工具模拟器画面；未做逐像素差异比对，也不构成正式环境验收。

主代理随后尝试使用原生 Computer Use 读取微信开发者工具窗口，返回 Mac 当前锁屏，未取得额外原生窗口证据。此限制不影响上文已经完成的微信 CLI 与模拟器自动化定向读数。
