# R1 个人数据盘点与权利请求边界（2026-09-25）

本文件核对当前代码，不代表已获批的保存期限或法律结论。PRD RQ18 要求将个人资料、自行发布内容、共同活动事实和争议证据分开处理；保存期限与依据须由数据负责人和法务按实际用途批准。现阶段 `/privacy/requests` 可以提交 `EXPORT`、`DELETE`、`CORRECT` 请求并供受限运营人员查看，但**尚无删除或更正执行流程**，不能将请求创建视为已完成。

| 数据类别 | 当前表或字段 | 本地已实现 | 删除前必须明确的处理 |
| --- | --- | --- | --- |
| 账号和授权 | `users.wechat_openid`、`sessions`、`notification_consents`、`event_aliases` | 本人导出账号、同意及昵称；可撤回通知同意和活动昵称 | 注销身份核验、会话撤销、外部通知停止、公开昵称撤回 |
| 本人活动与参与 | `events`、`event_versions`、`event_status_history`、`registrations`、`registration_status_history`、`reservations`、`offers`、`offer_status_history`、`checkins`、`manual_checkins`、`outcomes`、`outcome_feedback`、`expense_ledgers`、`expense_shares` | 本人主办活动当前及历史版本、状态时间线、完成结果、本人创建的费用台账摘要，以及自己的报名、报名状态时间线、认领预留、补位邀请与状态时间线、签到、反馈和费用份额可导出 | 仍在进行的活动、共同记录最小去标识化、费用争议隔离 |
| 分享和协作 | `share_intents`、`share_opens`、`activity_content`、`activity_fact_todos` | 本人分享／归因打开、本人发布内容及事实提问可导出；分享口令不包含在导出里 | 删除本人可撤回内容与保留公共活动必要事实的界限 |
| 通知和操作记录 | `notifications`、`jobs`、`idempotency`、`audit`、`business_events`、`notification_followups` | 本人通知及其内容、本人操作审计元数据及迁移 12 后同一审计来源的脱敏业务事件可导出；内部跟进说明和任务载荷不自动导出 | 已发送外部效果、审计依据、内部备注中的第三人数据与访问角色 |
| 举报与争议 | `reports`、`appeals`、`registration_removals`、`event_safety_holds`、`event_review_decisions`、`outcome_reviews` | 本人举报、申诉和移除原因可导出；主办本人导出仅含结项裁决的活动、结论与时间，运营核查理由及另一成员的举报内容不直接外露 | 有效争议或法定保存的隔离、复核权限、到期清理 |
| 备份与运行记录 | PGlite/目标 PostgreSQL 备份、限流桶、部署日志 | 已有本地备份和 PostgreSQL 恢复演练 | 备份轮换期限、恢复后重放删除标记、日志脱敏与清理 |

这次扩大 `/privacy/export` 的本人范围：增加主办活动版本与完成结果、本人创建的费用台账摘要、分享行为、本人认领预留、补位邀请、人工签到发起人、事实问题和不含 `detail` 的本人审计动作；通知导出包括本人可见的 `detail`。所有导出查询在只读、一致性快照事务中执行，按本人 ID、主办身份或本人报名关联过滤，不包含其他参与者的报名、补位和问题。内审备注、密钥、分享口令、会话摘要与他人的个人信息不自动返回。

上线前需由数据负责人和法务逐类确认：保存目的与期限、删除与更正的可执行字段、活动中／争议中请求的处理方式、用户可见回复模板、备份轮换和恢复后的删除重放。随后才可实现并演练执行器；不能给 `DELETE` 请求写入虚假的“已完成”。[PRD 第 15.3 节](/Users/tsb/Downloads/01_PRD_v1.0.md)提出上述分类原则；[《个人信息保护法》全文](https://www.samr.gov.cn/wljys/gzzd/art/2023/art_3ef1e889c1e644d4b65b5f5c7f432386.html)与[《网络数据安全管理条例》](https://xzfg.moj.gov.cn/mobile/law/detail?LawID=1734)是后续政策审查的官方依据。

验证：`pnpm test` 109/109 通过，`pnpm typecheck` 通过；新测试 `test/privacy-export.test.ts` 覆盖本人分享、补位邀请、事实提问、审计、主办活动结果、费用台账和另一参与者数据隔离。全新本地 PostgreSQL 18.6 库 `irl_r1_test_privacy_final_20260925` 完成迁移 1–9、双连接池及本人导出检查，输出 `personalExportCrossPool=true`、`personalExportSnapshot=true`；后者在导出期间由另一连接池写入新活动版本，验证导出版本前后一致。这些是本地功能证据，不是删除流程、真实账号或目标部署环境的验收。

微信开发者工具 `2.02.2608070` 本地模拟器（2026-09-25）：用独立 PGlite 数据目录和 `DEV_AUTH=1` 启动 API，切到“我的”页，通过页面的 `exportData` 处理器请求 `/privacy/export` 并调用微信剪贴板接口。页面返回“本人数据 JSON 已复制，可粘贴保存。”，截图见 [privacy-export-simulator-2026-09-25.jpg](privacy-export-simulator-2026-09-25.jpg)。这验证本地模拟器入口；真实 AppID、真机和线上 HTTPS 域名仍未配置。

2026-09-27 补充：第 32 版迁移后，主办本人导出增加按活动版本保存的场地主办声明元数据；其他成员的本人导出不含主办声明记录。见[场地依据验证](venue-host-statement-2026-09-27.md)。本补充不改变上述保存期限与注销执行仍待批准的结论。

2026-09-27 再补充：协办授权现分别作为本人收到的授权与本人发出的授权进入只读一致性快照导出。收到的记录只含自己的授权元数据，不含授权人标识；发出的记录不含被授权人标识或授权记录 ID。定向测试先证明字段缺失，再验证两个被授权人同时存在时，个人导出仍不带另一成员的授权标识。`pnpm typecheck` 与全量 `pnpm test` 405/405 通过。此项只补导出范围，不代表注销执行已完成。

同日本地微信开发者工具 0.3.11 以现有测试 AppID 打开 `pages/me/me`，连接临时 PGlite API；先由 HTTP 创建一场合成邀请活动和一条协办授权，确认导出接口返回一条发出授权且无被授权人字段。随后实际点击“复制本人数据 JSON”，页面显示复制成功；在模拟器运行时读取刚复制的 JSON 摘要，得到 `issuedCohostGrants=1`、`recipientExposed=false`、`hostedEvents=1`。直接调用页面异步方法的自动化请求曾超时，改为实际按钮点击后完成验证；未将该超时计作导出成功。该模拟器证据不代表真机或正式账号验收。
