# 第 30 版迁移后的本地 PGlite 备份恢复（2026-09-27）

- 范围：R1 本地开发库恢复能力。源库 `.data/outcome-issues-smoke` 是已停止本地 API 的合成活动库，包含第 30 版迁移及一条主办结项问题记录；归档和恢复库均保存在 Git 忽略的 `.data/`，无真实用户数据。
- `scripts/local-backup.ts backup` 返回 5089933 字节、SHA-256 `a981f3c1a59dda68d630ccb6081d87a6f5cc76e4821aec852f5ba74926a535de`。`restore` 到新目录 `.data/pglite30-restored-20260926` 返回 `verified: true`，即用 `createDatabase` 重新打开并核对迁移校验值。
- 随后以独立只读查询逐表比较源库和恢复库：公开 schema 共 43 张表，其中 14 张非空；每张表的行数和按完整行 JSON 排序后的内容摘要均一致。恢复库有 30 次迁移记录，含问题文本的结项记录为 1 条。
- 这验证本机 PGlite 的一份合成库；生产使用的 PostgreSQL 逻辑恢复另见 [30 版迁移与全表恢复复测](postgres-migration30-2026-09-26.md)。目标托管环境、异地存储、备份轮换和恢复时间目标仍待验。
