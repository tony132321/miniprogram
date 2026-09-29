# 第 66 版本机 PostgreSQL 备份恢复演练（2026-09-29）

范围：`AC-BACKUP-RESTORE` 的代码级本机补证。使用本机 PostgreSQL 18.6（`127.0.0.1:55432`）和两座本次新建的 `irl_r1_test_*` 合成库，没有接触现有测试库、真实成员数据或生产备份。已有 [PGlite 第 66 版演练](backup-restore-schema66-2026-09-29.md)；此前真实 PostgreSQL 归档恢复记录停留在第 33 版。

## 可复跑步骤

在仓库根目录、已启动本机 PostgreSQL 18.6 的前提下执行：

```sh
PATH=/Users/tsb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH \
  pnpm exec tsx scripts/verify-postgres-backup-restore66.ts
```

脚本 `scripts/verify-postgres-backup-restore66.ts` 固定连接回环地址，自动生成全新 `irl_r1_test_backup66_src_*`、`irl_r1_test_backup66_dst_*` 库名，先确认目标库为空，并保留这两个合成库供回读；不删除任何数据库。可通过 `IRL_PG_TEST_PORT` 与 `IRL_PG_BIN_DIR` 指向另一套回环本机 PostgreSQL 18.6 和 `pg_dump`/`pg_restore`。不接受现有库作为恢复目标。

应用域接口依次创建邀请制活动、运营内容审核、成员报名、协办审批授权、通知授权和授权历史；增加一条待外发通知及对应 `PENDING` job、一份私人草稿与举报。随后执行 `pg_dump --format=custom`，在**快照之后**通过保护性删除申请及 `executePrivacyDeletionWithMarker` 停用私人账号，将 fsync 标记存于数据库归档之外。`pg_restore --no-owner --no-acl --exit-on-error` 恢复到新空库；应用 `createProductionDatabase` 重新打开，核对 66 条迁移及上述业务行的完整投影。恢复旧快照时，该账号先为 `ACTIVE`；调用 `replayPrivacyDeletionMarkers` 后为 `DISABLED`，删除执行记录存在，私人草稿主办身份被去标识。再次回读其他成员的活动、报名、协办授权、通知授权及历史、outbox、审计，与快照前一致。脚本以断言失败退出，成功才输出 JSON。

## 本次原始样本

- 命令退出码 `0`；`pnpm typecheck` 退出码 `0`；`git diff --check -- scripts/verify-postgres-backup-restore66.ts` 退出码 `0`。
- PostgreSQL `18.6`，应用 schema `66`。源库：`irl_r1_test_backup66_src_1790644214271_a422ae`；恢复库：`irl_r1_test_backup66_dst_1790644214271_a422ae`。
- 归档：`/var/folders/yd/pk5w_13n5tg13bp1hvrxpfph0000gn/T/irl-pg66-restore-ZU2qpm/before-delete.dump`，`204459` 字节，SHA-256 `228d5f0ed23c1c6783ae7ec820ba87d16977c94969ff03bb41fff7a046ece4cc`。外置标记：同目录 `deletion-markers.jsonl`。
- `backupDurationMs=74`；`restoreReplayReadbackMs=153`（`pg_restore`、应用打开、标记重放及业务回读总耗时）。此合成样本在快照完成前已有的记录无缺行；快照后的删除意图依赖外置标记重放保住。未注入故障或模拟备份间隔，RPO 未测得。独立 `psql` 回读恢复库为 `66|1|1|DISABLED`，分别是迁移数、指定成员报名数、指定协办授权数、删除账号状态。
- 活动 ID `18941e47-5cf9-4ea1-8d19-3f1c4bf19f44`；删除申请 ID `142de1f5-9c17-4081-ade6-4261e1fbf2ca`。这些均为合成标识。

输出字段明确改为 `snapshotRecordsMissing=0`、`sampledRpoMs=null` 后，又在两座全新合成库 `irl_r1_test_backup66_src_1790644387663_ed100e`、`irl_r1_test_backup66_dst_1790644387663_ed100e` 复跑，退出码 `0`；该次备份耗时 `70 ms`、恢复／标记重放／回读耗时 `230 ms`，原快照记录无缺行，RPO 明确未测得。

独立复核发现只断言私人草稿主办 ID 不等于旧 ID 时，缺行也会误通过。脚本现先确认恢复前原草稿恰有一行且主办为原身份，标记重放后同一草稿仍恰有一行且主办符合删除墓碑格式。修正后再次用全新合成源库 `irl_r1_test_backup66_src_1790644853708_bc091f` 和目标库 `irl_r1_test_backup66_dst_1790644853708_bc091f` 运行，退出码 `0`；该次备份 `51 ms`、恢复／重放／回读 `141 ms`，`snapshotRecordsMissing=0`、`sampledRpoMs=null`。

以上毫秒数来自一次本机空负载小数据集演练，不是目标环境 RTO 承诺。本演练没有连续归档、计划备份间隔或异地标记库，不能推导真实故障后的 RPO。正式环境的 RPO ≤15 分钟、RTO ≤4 小时、备份调度与轮换、隔离恢复、容量、故障注入、外置标记独立持久性和真实运营验收仍需在目标基础设施上验证。因此 `AC-BACKUP-RESTORE` 仍为部分完成。
