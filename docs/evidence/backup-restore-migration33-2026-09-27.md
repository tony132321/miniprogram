# 第 33 版迁移后的本机备份恢复（2026-09-27）

- 范围：RQ18。本次仅使用已停止服务的合成 PGlite 库和本机隔离 PostgreSQL 18.6 测试库；归档及恢复目录均在 Git 忽略的 `.data/`。目标托管环境仍未接入。
- PGlite：从 `.data/share-events-smoke` 运行 `scripts/local-backup.ts backup`，归档 5,254,897 字节，SHA-256 `7409de2f9007785e8c81d395586e3b8a409dc4b9a2eb0eae4373585afd8cfd2f`；恢复到新的 `.data/pglite33-restored-20260927`，返回 `verified: true`。分别以应用的 `createDatabase` 打开源库和恢复库，迁移校验值通过；45 张公开表的行数与完整行排序摘要全部一致，其中 18 张非空。恢复库有连续 33 条迁移，3 条场地主办声明覆盖 `PUBLISH`、`CHANGE`、`FORMATION`。服务层 `getEvent` 回读变更后的活动与 `CHANGE` 声明；主办本人数据导出回读该活动 2 条历史声明。
- PostgreSQL：从 `irl_r1_test_venue33_20260927` 执行 `pg_dump -Fc`，归档 `.data/pg33-20260927.dump` 为 373,292 字节，SHA-256 `4b461e456b9e8272280f7c9126194fed508b2b4d7b76434040a95b55238d2e29`；用 `pg_restore --no-owner --no-acl` 恢复到新的空库 `irl_r1_test_restore33_20260927`。分别以应用的 `createProductionDatabase` 打开两库，迁移校验值通过；45 张公开表的行数与完整行排序摘要全部一致，其中 30 张非空。恢复库有连续 33 条迁移，18 条场地主办声明覆盖三个阶段。服务层回读 `CONFIRMED` 活动的 `FORMATION` 声明，主办本人导出回读该活动 3 条历史声明。
- 本次证明本机归档可恢复已实施的第 33 版表和数据。目标 PostgreSQL 环境的定时备份、异地保存、轮换、故障演练、恢复时间目标与运营交接仍需在实际部署环境验证。
