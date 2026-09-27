# Schema 50 活动内昵称授权：微信模拟器回归（2026-09-28）

- **代码**：模拟器与 API 启动时主工作树为 `137feef`，schema version 50；微信开发者工具 RC v2.02.2609231、`wechatide` 0.3.11。测试期间并行提交 `30a12e4` 未修改本次使用的 `src/`、`miniprogram/`。
- **隔离数据**：`DEV_AUTH=1`，本机 API `127.0.0.1:3000`，PGlite `.data/wechat-alias-schema50-20260928-run1`。合成邀请活动 `2e921fe0-8b38-4a09-a428-b6f464cfdbc3`，`alias_owner` 与 `alias_viewer` 均为已报名成员。
- **旧记录来源**：在 schema 50 的全新隔离库中，通过业务模块建立并批准活动、报名两人后，人工插入 `event_aliases` 旧格式合成记录：`display_name=旧版合成昵称`、`notice_version=NULL`。它模拟升级后旧昵称的状态；本次没有在模拟器中执行真实旧库迁移。

| 阶段 | 模拟器实际操作与页面状态 | 独立 API / DB 回读 |
| --- | --- | --- |
| 旧昵称隐藏 | `alias_viewer` 打开活动详情，页面 `aliases=[]`，未显示旧昵称。`alias_owner` 打开同一页，看到“旧昵称尚未按当前展示说明确认…”和当前说明正文“仅在本活动内展示的昵称（可选）”；页面 `aliasReconfirmationRequired=true`、`aliasNoticeVersion` 非空。 | 授权前两名成员 `GET /events/{id}/aliases` 的 `items=[]`；本人接口 `reconfirmationRequired=true`。原始行 `notice_version=NULL`。 |
| 同意后展示 | `alias_owner` 在昵称输入框实际输入“新版合成昵称”，点击“同意展示并保存本活动昵称”；页面提示已保存，`aliasReconfirmationRequired=false`。切换为 `alias_viewer` 再打开活动，页面显示“活动内授权昵称：新版合成昵称”，`aliases[0].isMine=false`。 | `alias_viewer` 的独立 API 返回该昵称；当前说明 `purpose=EVENT_MEMBER_DISPLAY`、`scope=EVENT:{id}:MEMBERS`、`version=4a85fb70f0cbb67dd79220047fa3d5dd5227bc927bc239949aeddf80f2d1150c`。 |
| 撤回后隐藏 | 切回 `alias_owner`，实际点击“撤回本活动昵称展示”；页面提示已撤回，`aliases=[]`。再次切为 `alias_viewer` 打开活动，页面 `aliases=[]`，不再显示昵称。 | 双方 API `items=[]`。停用本机 API 后查询隔离 DB：`event_aliases` 无该活动昵称行；`event_alias_consent_history` 保留两条 `source=USER` 决策，依次 `granted=true`、`granted=false`，均记录上述当前 `notice_version`、说明正文、活动范围；`schema_migrations` 最大版本为 50。 |

截图：[旧昵称在另一成员页隐藏](wechat-alias50-viewer-legacy-hidden-2026-09-28.jpg) · [本人重确认提示与说明](wechat-alias50-owner-reconfirm-2026-09-28.jpg) · [同意后另一成员可见](wechat-alias50-viewer-granted-visible-2026-09-28.jpg) · [撤回后另一成员不可见](wechat-alias50-viewer-revoked-hidden-2026-09-28.jpg)。

页面直接展示的是**说明正文**；版本 hash 由页面运行时和 API 传入授权请求，并未作为文字打印给用户。测试中开发者工具曾在切换页面后失联，自动化读取与截图超时；重启工具后连接恢复，以上按钮点击及跨账号回读均在恢复后完成。此证据只覆盖合成身份、本机 API 和开发者工具模拟器，不构成真机、正式 AppID 或正式发布验收。
