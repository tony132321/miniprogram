# T04 我的活动加载与恢复本机证据（2026-09-26）

复用 `GET /me/events` 和原有 `pages/index/index`，服务端列表增加 `isHost`、`myRegistrationStatus`，只把仍有活动访问权限的报名者列入成员视角。页面依据服务端真实状态分为“我组织”“待确认”“即将参加”“历史”，显示中文活动与报名状态。加载中、网络或登录失败、真正空列表互相区分；失败页提供重试，正式身份会在 `UNAUTHENTICATED` 后先重新登录再读列表。身份切换继续清除旧账号列表，迟到响应仍不覆盖新账号。

先加失败测试，得到接口缺少 `isHost`、页面缺少错误状态的失败结果。修改后定向 `test/api.test.ts` 与 `test/miniprogram.test.ts` 64/64 通过；全量 `pnpm test` 257/257、`pnpm typecheck`、`git diff --check` 通过。测试覆盖主办及报名状态、断网后重试归类、登录失效后重新登录。已有流程测试覆盖活动跳转及报名退出；本次没有设计新视觉 UI。

微信开发者工具测试号、本机模拟器：先在本地 API 停止时打开“我的活动”，页面数据 `loadState=ERROR`、`errorCode=NETWORK_ERROR`，画面显示[失败及重试按钮](wechat-index-network-error-2026-09-26.jpg)，没有错误地显示“暂无活动”。随后启动独立合成数据目录 `.data/wechat-index-20260926` 的 API，执行页面 `retry`，读回 `loadState=READY`、零条活动，画面显示[真实空列表](wechat-index-recovered-2026-09-26.jpg)。测试后已停止本地 API。

本机模拟器结果不能代替真机、大字体、正式微信会话或候选环境网络测试；这四项仍未验收。
