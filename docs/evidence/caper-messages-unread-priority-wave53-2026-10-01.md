# CAPER 消息首页“未读优先”真实通知卡（Wave 53，2026-10-01）

## 参考与改动

对照用户 `stitch_design_system_generator (2).zip` 的 `caper_3/screen.png` 与 `code.html`，消息首页在“最近会话”下方有“未读优先”卡片。原实现只有分组通知，缺少该层级。现在从本人已加载、当前筛选可见的 `/me/notifications` 记录中选前两条未读，显示现有种类图标、通知标题、类别、时间和真实摘要；标题旁数字表示当前已加载的匹配未读数。仅在“全部消息”且未输入搜索词时呈现，避免筛选/搜索页重复强调不匹配的通知。

每一行复用 `openNotice`，因此目标由通知 ID、活动 ID 和种类决定，导航成功后才按现有逻辑标记已读；“全部”进入已有通知中心。账号切换时与通知列表一起清空优先卡，防止旧账号内容残留。参考图里的人物会话、AI 对话、群聊和活动照片仍无 R1 数据源或接口，没有填入虚构内容。

## 定向验证

- 先新增当前账号真实通知、目标深链和账号切换清空的局部测试，初始因缺少 `priorityItems` 失败；实现后 `test/miniprogram-messages-hierarchy.test.ts`、`test/miniprogram-caper-message-parity.test.ts`、`test/miniprogram-messages.test.ts` 共 **42/42** 通过。
- `tsc --noEmit`、`node --check miniprogram/pages/messages/messages.js` 和上述四个文件的 `git diff --check` 均退出码 0。
- 未运行全量测试。[隔离微信开发者工具复核](caper-wave53-messages-pg06-devtools-2026-10-01.md)已显示合成账号真实 1 条未读优先卡，“全部”进入通知中心、该行进入同 ID 活动，异常 0。本轮只有 1 条未读，双行视觉和真实分页仍由定向用例约束；无真机、订阅送达或外部服务验收结论。
