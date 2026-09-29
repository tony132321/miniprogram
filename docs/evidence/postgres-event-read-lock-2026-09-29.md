# 活动详情同版本清洗读锁演练（本机 PostgreSQL）

2026-09-29 使用本机 PostgreSQL 18.6、独立新建的合成数据库 `irl_r1_test_event_read_lock_1790648941589_4a3b65` 运行：

```sh
pnpm exec tsx scripts/verify-postgres-event-read-lock.ts
```

脚本创建 schema 66 的活动及一位已确认成员。连接一通过生产数据库适配器调用 `getEvent()`，取得活动行 `FOR SHARE` 锁后暂停；连接二绕过应用层 advisory lock，直接执行不增加 `events.version` 的活动正文 UPDATE。`pg_stat_activity` 观察到连接二处于 PostgreSQL `Lock` 等待。释放连接一后，连接二完成活动及历史版本清洗并提交。连接一在提交前读到原文；提交后的新请求只读到清洗正文，版本均为 1。

输出：`schemaVersion=66`，`independentConnections=2`，`writerWaitedOnEventLock=true`，`readBeforeCommit="private host event text"`，`readAfterCommit="已注销账号的活动"`，`versionUnchanged=true`，退出码 0。

随后以显式 `IRL_PG_TEST_URL=postgresql://tsb@127.0.0.1:55432/irl_r1_test_ci_input` 重新执行同一脚本，新建隔离数据库 `irl_r1_test_event_read_lock_1790649236041_53a5b7`，输出同样满足上述断言，退出码 0。CI 的 `postgres-event-read-lock` 作业使用 PostgreSQL 18 容器和该显式连接配置；远端结果须以最终提交的 Actions 运行核对。

这证明顶层活动详情读事务确实让同版事件正文写入等待。连接二采用合成 SQL 清洗来单独验证 PostgreSQL 行锁，并未在这份演练中运行完整 `deidentifySharedActivity` 或覆盖所有成员列表、自由文本、嵌套 JSON 和 HTTP 响应发送时序；真实账号与目标环境仍需单独验收。
