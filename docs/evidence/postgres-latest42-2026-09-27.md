# PostgreSQL 第 42 版迁移、本机并发与恢复验证（2026-09-27）

环境：本机 PostgreSQL 18.6、回环地址 `127.0.0.1:55432`、全新隔离数据库 `irl_r1_test_*`。测试数据均为合成数据；以下结果不代表目标部署环境、微信正式身份或生产备份策略。

- 在空库运行 `scripts/verify-postgres.ts`，42 个迁移全部应用。两个独立连接池发起 100 个抢位请求，读回确认 4、候补 99、审计行 106。脚本输出中的运营 OTP 单次使用、跨池会话/退出、公开与应急开关、补位、内容审核、任务恢复、数据库时钟及截止竞争等检查均为 `true`。完整输出在本地忽略目录 `.data/pg-latest42-verification.log`。
- 在另一空库运行 `scripts/verify-postgres-history-upgrade.ts`：先构建第 39 版等价的合成旧数据，再由两个连接池并发应用 40–42 版。三个旧状态各生成一条 `legacy_snapshot`；升级前截止点的指标保留“未知”，升级后的补位状态为已接受，到场率为 `null` 而非虚构百分比；本人导出能读取三类历史。后续三种状态更新各写入第二条历史，脚本退出码 0。
- 对第 42 版测试库执行 `pg_dump -Fc`，恢复到全新数据库，`pg_restore` 退出码 0。源库和恢复库的 `max(schema_migrations.version) | audit | events | registrations | offer_status_history | event_status_history | registration_status_history` 均为 `42|201|11|130|7|24|140`。
- 更新后的微信开发者工具已登录，使用仓库测试 AppID、独立 PGlite 开发 API 和开发身份 `host`。模拟器打开“我的活动”“发起”“我的”，首页与个人页运行状态为 `READY`，发起页为 `IDLE`；首页 `/me/events` 网络记录为 HTTP 200、空列表。[首页截图](wechat-updated-index-2026-09-27.jpg)。这是模拟器与本机 API 验证，不是真机、正式微信登录或目标 PostgreSQL 网络验证。

目标部署环境的数据库备份恢复、故障演练、正式 HTTPS 域名、正式 AppID、消息模板、真人值守与三场受控活动仍需真实资源和实测证据。
