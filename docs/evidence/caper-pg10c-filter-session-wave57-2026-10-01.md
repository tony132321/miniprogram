# PG10-C 分类与详情交互的旧会话清理（2026-10-01）

范围：工作区 `f17364a` 之上的定向修改，仅涉及本人活动记录页 `subpackages/profile/moments/moments.js` 及其会话隔离测试。消息关闭态仍经既有 `/subpackages/profile/moments/moments?filter=all` 进入当前身份的活动记录；活动详情目标和当前身份筛选不变。

## 复现与原因

独立 VM 先以同一成员的 `first-session` 载入一场主办活动，点击“我参与的”使当前列表为空，再将存储令牌换为 `second-session`，不重新触发页面 `onShow`，点击“我主办的”。旧实现直接从缓存 `events` 重建 `visibleEvents`，结果旧活动卡再次出现，`loadState` 仍为 `READY`。此次过程中只读了一次 `/me/events`，没有第二次请求或导航。

`openActivity` 原本核对身份并阻止旧卡跳转，但未清空旧卡；`showAllActivities` 原本也阻止旧身份切回全部，但仍保留缓存。现在三个入口共用 `clearPrivateAfterIdentityChange()`：会话变化时增加加载代次、清空 `events`／`visibleEvents`、恢复全部分类并关闭更多菜单，显示“账号已切换，请重新加载活动记录。”，停止本次列表重建或详情导航。重新加载后仍从当前会话读取 `/me/events`，有效卡进入原活动详情路径。

## 定向红绿验证

先补旧详情卡清理断言，以及“空分类→换令牌→切主办”和“退出登录→查看全部”两条回归。仅运行 `test/miniprogram-moments-session-isolation.test.ts`，结果 **2/5 通过、3 条按预期失败**；失败均为旧 `events` 缓存未清空，没有测试初始化或环境错误。

实现统一入口后执行：

```sh
node --import tsx --test --test-concurrency=1 test/miniprogram-moments-session-isolation.test.ts test/miniprogram-caper-profile-visual.test.ts test/miniprogram-caper-message-parity.test.ts
node --check miniprogram/subpackages/profile/moments/moments.js
node node_modules/typescript/bin/tsc --noEmit
git diff --check -- miniprogram/subpackages/profile/moments/moments.js test/miniprogram-moments-session-isolation.test.ts
```

本机以打包 Node `/Users/tsb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node` 执行前三条：定向 **32/32** 通过，JS 语法、类型与受影响文件差异检查均退出 0。回归同时确认：新会话重新加载后显示新活动，正常筛选与 `/pages/event/event?id=new-event` 仍可达。按任务范围未运行全量测试。

## 最短模拟器复核步骤与证据边界

本次子任务未操作共享微信开发者工具，以下为待执行路径，不构成模拟器实点记录：

1. 当前合成身份的消息页 `loadState=READY`、`filter=ALL` 时点击 `.conversation-jump`，确认 `viewMode=CHAT_UNAVAILABLE`；点击 `.private-chat-links` 中首个“查看我的活动”，进入 `subpackages/profile/moments/moments`，确认 `activeFilter=all`、`loadState=READY`，记录本人活动 ID。
2. 留在本人活动记录页，替换 `devUser`，或为同一用户换 `sessionToken`，不重新加载页面；点击 `.moments-filter` 中“我主办的”。预期 route 仍为活动记录页，`events=[]`、`visibleEvents=[]`、`activeFilter=all`、`loadState=ERROR`，出现账号切换提示，旧卡消失。
3. 恢复合成身份并重新加载，确认正常列表仍可筛选；点击当前卡 `.moment-photo-layout`，确认活动详情 ID 与当前卡相同。旧身份卡不能用于详情导航；该分支已有定向自动化断言，尚未本轮模拟器实点。

本记录只支持旧会话交互的本地定向验证，不提升为模拟器、真机、真实照片服务或正式发布验收。
