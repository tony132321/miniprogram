# PG11-C 私聊关闭态至 PG10-C 本人活动记录定向核验（2026-10-01）

范围：工作区 `9074e5d` 之上的未提交改动；只核对消息页 `CHAT_UNAVAILABLE` 的“查看我的活动”入口、返回状态和会话切换保护。未运行全量测试。

## 代码与定向测试

- `miniprogram/pages/messages/messages.wxml` 中关闭态的活动场景卡和底部链接各有一个 `bindtap="goMyActivities"`。`messages.js` 的目标是 `/subpackages/profile/moments/moments?filter=all`；正常点击先恢复 `INBOX` 和 TabBar。`moments.js` 的 `onShow` 按当前 session token／开发身份读取 `/me/events`，加载代次和身份检查阻止旧请求回填。
- 发现会话切换边界：旧关闭态中点击“查看我的活动”时，`backToInbox()` 会清除旧身份页面并返回，但原 `goMyActivities()` 仍继续导航。新会话隔离测试先以 **4/5、1 个预期失败**复现：实际多出 `/subpackages/profile/moments/moments?filter=all` 导航。现于入口先运行 `clearPrivateAfterIdentityChange()`，账号变化时清理旧状态并停止导航。
- `test/miniprogram-caper-message-parity.test.ts` 继续断言正常目标，并补查点击后 `INBOX` 与 TabBar 可见；`test/miniprogram-messages-session-isolation.test.ts` 新增旧 token 点击阻断断言。上述两文件连同 `test/miniprogram-messages-hierarchy.test.ts`、`test/miniprogram-moments-session-isolation.test.ts` 定向 **21/21 通过**。`pnpm typecheck`、改动文件 `git diff --check` 均退出 0。

## 微信开发者工具边界

隔离项目 `/private/tmp/irl-pg05s-final-20261001` 只同步了修改后的 `messages.js`，其测试配置连接本机合成 API `127.0.0.1:3037`。测试 AppID `wxbbcab69099026d3f`、CLI 端口 `21467`；`cli preview` 退出 0，总包 **1,978,562 Byte**。准备经 Automator 端口 `9536` 实点“最近会话”→关闭态“查看我的活动”→活动记录并截图，但自动化脚本在首张截图前持续等待，未取得可核对的点击、路由或画面读数；恢复原 PG05-S 成功页的脚本亦未完成。两脚本已中止并释放模拟器。故本次 **没有** PG11-C→PG10-C 模拟器实点证据，原 PG05-S 画面状态也未重新确认。

本记录证明该路由及会话边界的代码和定向测试结果、隔离项目的 CLI 编译结果；不构成模拟器实点、真机、照片服务或正式环境验收。
