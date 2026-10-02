# R1 schema 49 本地候选核验（2026-09-28）

核验对象为主工作树提交 `f174434`，包含邀请活动人工审核、通知用途契约、通知已读顺序修复；复用原工程和既有测试。下述均是本机或合成身份结果，不代表正式小程序、真实提供方或上线放行。

| 检查 | 实际结果 |
| --- | --- |
| `pnpm test` | 510/510 通过，0 失败；本机运行约 142 秒。 |
| `pnpm typecheck` | 退出码 0。 |
| `pnpm audit --audit-level high` | `No known vulnerabilities found`。 |
| 全新 PostgreSQL 18.6 测试库 | `scripts/verify-postgres.ts` 退出码 0；49 个迁移、两个连接池、100 个并发竞争者，确认 4、候补 99；跨池隐私保护、通知跟进及既有并发检查为真。 |
| 48→49 升级 | 在复制的本机合成库运行 `scripts/verify-postgres-notification-upgrade.ts`：462 条旧通知及其状态保持不变，447 条已有外发任务补齐契约字段。 |
| `pnpm preflight:release` | 退出码 1：缺公开 HTTPS 合法域名、正式 AppID/主体，仍开启开发身份，开发者工具项目与本机私有配置关闭域名校验。此失败是当前发布阻断，不是已通过项。 |

针对性回归先在旧实现复现两个问题，再验证修复：`PURPOSE_NOT_CONFIGURED` 不再显示为不明状态，而显示“未开通外部提醒”；活动通知的 `wx.navigateTo` 失败时不标已读，成功后才调用打开接口。微信开发者工具的邀请审核链路证据见[模拟器回归](wechat-invite48-simulator-2026-09-28.md)，该证据是在 schema 48 候选上生成；最终 schema 49 的[PG02 聚焦页面复查](wechat-pg02-schema49-simulator-2026-09-28.md)验证了上述通知状态和导航顺序。

正式 AppID/密钥、合法 HTTPS 域名、微信订阅模板、真实账号与真机、目标 PostgreSQL/TLS/备份演练、具名运营值守、个人资料保存和删除政策、至少三场受控真人活动均未得到验收。外部通知生产适配器尚未配置，站内通知与人工跟进仍为当前可核实路径。
