# v3.1 候补截止窗口与数据库时钟（2026-09-25）

来源：开发包 T16 的 `AC-OFFER-WINDOW` 及 `AC-OFFER-RACE` 中的数据库时钟要求。沿用原活动锁、报名、offer、预留和站内通知表。补位事务每次分配席位前读取数据库 `clock_timestamp()`；截止前不足五分钟时停止新 offer，仍有候补才给主办方一条 `WAITLIST_WINDOW_CLOSED` 站内提醒。相同活动版本重复释放席位不会重复提醒。个人页显示中文处理提示。正常新 offer 的到期时间取 15 分钟或报名截止的较早者。

先写失败用例验证 4 分 59 秒不产生 offer、主办方有一次提醒；又加入两次释放席位的提醒去重及截止封顶回归。原代码不会生成主办方提醒，重复通知首次实现也被测试检出并修正。50 个相关定向用例通过。

全新本机 PostgreSQL 18.6 库 `irl_r1_test_20260925_offer_clock` 执行迁移 1–23、双连接池与 100 人争抢最后席位。在应用进程时钟人为快进一小时期间，第二连接池仍按数据库时钟接受未过期的 offer，输出 `offerDatabaseClockCrossPool=true`；同一脚本也得到 `waitlistTieCrossPool=true`。PGlite 的模拟时钟随应用进程变化，因此该时钟差测试专门在独立 PostgreSQL 执行。

随后在另一全新本机库 `irl_r1_test_20260925_offer_races_v2`，让接受过期 offer 与过期任务在两个连接池同时运行：接受方返回 `OFFER_UNAVAILABLE`，旧 offer 为 `EXPIRED`，只有下一位有一个 `ACTIVE` offer。又让预留认领与过期任务同时运行：认领方返回 `RESERVATION_UNAVAILABLE`，预留仅释放，下一位只有一个有效 offer。脚本输出 `offerExpiryRaceCrossPool=true`、`reservationExpiryRaceCrossPool=true`；数据库实例已停止。首次脚本运行因验证断言沿用测试报名的旧 ID 失败，修正断言后在新空库重跑通过，未修改产品数据。

本次核对了补位、接受、拒绝、offer 过期、预留认领/过期与容量统计的边界时钟。`pnpm test` 244/244、`pnpm typecheck` 与 `git diff --check` 通过。并发验证控制在请求开始前已过期的分支；恰好跨越截止瞬间、接受先提交的对照分支和目标环境故障仍需补验。本机站内提醒不等于微信订阅消息送达。

微信开发者工具测试号和本地开发身份 `host`：在独立合成库 `.data/wechat-block-20260925` 将已有活动截止设为释放席位后不足五分钟，服务端回读 `WAITLIST_WINDOW_CLOSED` 一条、有效 offer 零条。模拟器“我的与通知”页面实际渲染[主办方处理提示](wechat-offer-window-host-2026-09-25.jpg)，页面数据回读 `devUser=host`、通知种类与活动版本正确。本地 API 在截图后停止。这是模拟器与本机数据验证，非真机或正式账号送达。
