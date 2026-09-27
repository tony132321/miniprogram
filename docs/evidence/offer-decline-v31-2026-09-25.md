# v3.1 候补主动拒绝验收（2026-09-25）

来源：开发包 T16 的 `AC-OFFER-DECLINE`，复用现有 `offers`、报名、活动锁、FIFO 顺延、站内通知与个人页。本人拒绝有效 offer 时，在一个事务中将 offer 置为 `DECLINED`、报名置为 `CANCELLED`，再为下一位候补生成 offer；同键或新键重复拒绝都返回原拒绝状态，不重复释放席位。其他用户不能代拒绝。风险暂停期间接受按钮不可用，但拒绝按钮仍可用，恢复后才继续顺延。通知展示真实截止时间；offer 失效后拒绝按钮随服务端状态消失。

先写失败用例，验证顺延、归属和重复拒绝；原实现缺少该动作。`test/registrations.test.ts` 验证下一位获得唯一有效 offer、拒绝者不自动回候补；`test/api.test.ts` 验证 HTTP 归属；`test/notifications.test.ts` 验证风险暂停期间可拒绝、解除后顺延；`test/miniprogram.test.ts` 验证个人页请求与刷新。全量 `pnpm test` 239/239、`pnpm typecheck`、`git diff --check` 通过。

微信开发者工具测试 AppID、本机 API、独立 `.data/wechat-block-20260925` 合成库：活动已满时 `w1` 收到[有效补位通知及截止时间](wechat-offer-decline-before-2026-09-25.jpg)。以 `w1` 身份实际点击“拒绝补位”后，页面出现[成功提示且不再显示补位按钮](wechat-offer-declined-2026-09-25.jpg)。服务端回读 `w1` 报名 `CANCELLED`、`w2` 收到唯一 `WAITLIST_OFFER`，可接受且可拒绝。本地 API 在验证后已停止。

这些是本机合成数据和模拟器点击，不代表微信订阅消息送达或正式真机操作。
