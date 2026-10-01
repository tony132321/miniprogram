# 结项待办通知直达主办表单（2026-10-01）

## 缺口与边界

R1 的 `EVENT_OUTCOME_DUE` 在活动结束后生成主办方站内待办。消息页按钮写“记录活动结项”，此前只进入主办工作台顶部，用户还需自行找到页面下部的实际举办／未举办表单。本次复用既有表单与服务端 `POST /events/:id/complete` 守卫；通知点击只导航，不提交结项或推断活动已经举办。

## 修复

- 消息通知按已加载通知行的实际种类把 `EVENT_OUTCOME_DUE` 定位到 `hostSection&entry=hostCompletion`，不使用按钮传入的分区决定目标；没有活动 ID 时不消费该动作。`wx.navigateTo` 成功回调之后才请求标记已打开，该回调本身不能证明活动页已成功加载或聚焦。
- 活动页刷新当前活动后，仅当路由 ID 与回读活动一致、当前会话仍相同、当前用户是主办方，且重新计算的结项时间／状态资格成立，才滚动到现有 `#hostCompletionForm`。不具资格的当前主办保留在工作台顶部及现有资格说明；非主办不能进入主办工作台。
- 原有首页历史卡 `hostRepeat`、主办公告、验码和成员反馈深链均保留。

## 定向验证

- 先修改 `test/miniprogram-message-card-parity.test.ts` 的结项目标，并新增 `test/miniprogram-outcome-notice-deeplink.test.ts`，旧实现出现 4 个预期失败：通知缺少入口参数、合格主办不聚焦表单、陈旧资格未重算、身份切换后仍滚动旧工作台。
- 修复后消息卡、活动导航、结项快捷按钮和消息会话相关 6 个测试文件最初 **61/61** 通过；叠加个人页同一待办、反馈深链和真实行核验后，10 个受影响聚焦文件 **97/97** 通过；`pnpm typecheck` 与变更文件差异检查通过。未运行全量测试。

## 微信开发者工具实点

模拟器实点时，`miniprogram/` 与隔离的微信开发者工具工程除本地 `config.js` 外 `diff -qr` 无差异。微信 CLI 以测试 AppID `wxbbcab69099026d3f` 预览成功，包总计 **2,155,780 Byte**。在模拟器以开发身份 `caper-pg06-end-muojsyze-host` 打开消息中心，实点真实 `EVENT_OUTCOME_DUE` 通知 `d33f2d6f-b642-46ea-990b-159e36d30da3` 的“记录活动结项”；服务端状态 `IN_APP → OPENED`，活动 `d444bdcf-30ec-49f5-8913-a1855128cc36` 打开主办工作台且现有 `#hostCompletionForm` 渲染，`canCompleteEvent=true`。活动结项 API 点击前后均为 HTTP 404，说明没有误提交；模拟器异常 0。见[消息通知卡](images/caper-wave32-outcome-notice-before-2026-10-01.png)与[目标结项表单](images/caper-wave32-outcome-notice-form-2026-10-01.png)。实点后仅加强活动页空身份守卫；同步后的完整小程序差异 0、最终 CLI 预览 **2,155,832 Byte**、受影响三文件定向 **26/26** 通过，最后修正未重复模拟器实点。

该实点经微信 CLI 与 MiniProgram Automator 模拟器会话完成，原生 CUA 未得到可操作的应用界面，不能当作真机验收。正式 AppID、HTTPS 域名、订阅模板、真机及三场受控活动仍需外部验收。
