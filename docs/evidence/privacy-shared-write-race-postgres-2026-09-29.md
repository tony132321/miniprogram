# 共享活动写入与删除扫描竞争：本机 PostgreSQL

在原有 `scripts/verify-postgres-privacy-expiry.ts` 的真 PostgreSQL 门禁中增加共享身份竞争验证；原有 AI 输入、普通资料到期和系统业务事件断言继续执行。测试数据库 `irl_r1_test_privacy_race3_20260929` 是新建空库，PostgreSQL 18.6 仅监听本机 `127.0.0.1:55432`，全部为合成身份及内容。脚本迁移至第 66 版；最终命令：

```sh
IRL_PG_TEST_URL=postgresql://tsb@127.0.0.1:55432/irl_r1_test_privacy_race3_20260929 pnpm exec tsx scripts/verify-postgres-privacy-expiry.ts
```

退出码 0。输出包括 `schemaVersion=66`、`independentConnections=2`、`lockWaitObserved=true`、`privacySharedWriteRace.writerBeforeDeletion=scrubbed`、`privacySharedWriteRace.deletionBeforeWriter=rejected_without_wait`、`systemEventRollbackVerified=true`。

- 普通写入先行：一个连接在事务内插入作者为待删除人的活动提问，保留用户行的 `FOR SHARE` 锁；另一个独立连接运行真实 `executePrivacyDeletionSafeguards`。脚本观察到删除事务在 PostgreSQL 等待用户行锁。写入提交后，删除继续，`deidentifySharedActivity` 将该提问作者改为本请求的活动墓碑、正文改为固定移除文案；随后用原身份再次插入被数据库拒绝。
- 删除锁先行：一个连接持有该人的 `FOR UPDATE` 用户行锁，另一个连接尝试插入活动提问。触发器以 `NOWAIT` 拒绝写入，没有悬挂等待或留下迟到内容。
- 首次运行到末尾因新增真实删除申请使原业务事件数量断言由 3 变为 4 而退出 1；已将断言纳入新增请求，在全新空库复跑通过。没有修改业务事件实现。

这是本机 PostgreSQL 的事务次序和字段回读证据，覆盖结构化作者身份与这条提问正文。它不证明所有自由文本或嵌套 JSON 均已盘点／处置，也不代替真实保留策略批准、生产独立删除标记服务、目标环境恢复演练或真机验收。
