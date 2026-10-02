# CAPER 消息页与通知中心对照复测（2026-09-30）

## 范围

对照用户 ZIP 中 `caper_3`、`pg02_n_1`、`pg02_n_2` 的 `screen.png`，沿用原 `pages/messages/messages` 路由和 R1 通知／主办审批接口。消息首页改为紧凑真实通知分组和短空态；通知中心改为分类、图标、状态、标题、说明和可操作卡片。通知中心进入时隐藏标签栏，返回或离开后恢复。设置按钮定位到个人页通知区，候补补位通知打开后也定位该区。没有把设计稿中的聊天、地图、支付或人物消息当成真实能力。

## 可复核证据

| 场景 | 操作及结果 | 画面 |
| --- | --- | --- |
| 主工程空态 | 测试 AppID、本地 API、当前合成身份打开消息页，进入通知中心后返回。真实通知队列为空；三个画面无页面异常。 | [首页](images/caper-messages-empty-inbox-2026-09-30.png)、[通知中心](images/caper-messages-empty-center-2026-09-30.png) |
| 隔离非空队列 | 独立 API 3037 与微信开发者工具 9493 加载合成账号的 7 条真实站内通知；首页按类呈现，通知中心显示卡片和未读状态，页面异常为 0。 | [首页](images/caper-messages-populated-inbox-2026-09-30.png)、[通知中心](images/caper-messages-populated-center-2026-09-30.png) |
| 候补通知动作 | 在隔离环境实际点击补位通知，`POST /me/notifications/:id/open` 后进入个人页通知区；API 回读该条为 `OPENED`，未读数由 7 变 6。此前同环境的补位接受操作已由 [E23](caper-three-state-isolated-devtools-2026-09-30.md) 验证，此处只验证通知打开与深链。 | 页面截图保存在隔离工作目录 `/private/tmp/caper-r1-e2e-20260930/messages-offer-profile-focus.png`；该截图中个人页原始枚举展示仍待单独修整。 |

当前源码的消息相关定向 `28/28`、`pnpm typecheck`、`git diff --check` 通过；微信开发者工具 CLI `preview` 退出码 0，总包 1,842,422 Byte。合成通知不代表真实微信订阅消息送达。卡片结构和间距比上一版更贴近原稿，但未进行逐像素差异验收；真实通知种类和审批场景也未逐一在新视觉中点击。
