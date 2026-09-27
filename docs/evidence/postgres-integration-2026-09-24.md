# 独立 PostgreSQL 迁移、并发与恢复演练（2026-09-24）

环境：macOS arm64，本机从[PostgreSQL 官方 18.6 源码](https://www.postgresql.org/ftp/source/v18.6/)构建临时实例，`postgres --version` 返回 `18.6`。源码归档 SHA-256 为 `983ee554ec53dbeb9b70797bef9fcf4e67e117e7e48ca1463cc80b3ff8e8ff3f`，与[官方校验值](https://ftp.postgresql.org/pub/source/v18.6/postgresql-18.6.tar.gz.sha256)一致。实例仅监听 `127.0.0.1:55432`，数据库和归档保存在 Git 忽略的 `.data/` 内。此实例不承载真实用户数据。

## 迁移与最后席位并发

在全新空库 `irl_r1_test_20260924` 上执行 `IRL_PG_TEST_URL=postgresql://tsb@127.0.0.1:55432/irl_r1_test_20260924 pnpm exec tsx scripts/verify-postgres.ts`。脚本并发启动两个 `createProductionDatabase` 连接池，五版迁移各记录一次；创建一场 4 人上限的邀请活动，主办方及两名参与者先占 3 席，100 名不同参与者交错使用两个连接池抢最后一席。

实际结果：`pools=2`、`contenders=100`、`confirmed=4`、`waitlisted=99`、`auditRows=104`。脚本还重复提交其中一个幂等键，确认返回同一报名 ID。对已有业务表的同一数据库再次执行时，脚本在迁移与写入前拒绝，错误为 `Verification database must be empty`。

代码复核后收紧了防误用检查：带 `?host=` 等连接串参数的 URL 在连接前拒绝；另建 `irl_r1_test_guard_20260924`，其中 `app.secret` 已有 1 行，脚本因非空用户 schema 拒绝，表中 1 行仍在且 `public.schema_migrations` 未创建。修正探针地址格式后，在另一全新库 `irl_r1_test_guardfix_20260924` 重跑，仍得到 `pools=2`、`contenders=100`、`confirmed=4`、`waitlisted=99`、`auditRows=104`。安全边界只允许显式 `127.0.0.1`、无连接串查询参数、以 `irl_r1_test_` 开头的空数据库。

## 逻辑备份与恢复

从源库运行 `pg_dump -Fc`，归档 SHA-256 为 `ff74ef9a81f04aa452b7a362911296b050253903c65628a9544112b0a1024bea`；用 `pg_restore --no-owner --no-acl` 恢复到新库 `irl_r1_restore_20260924`。恢复后由 `createProductionDatabase` 重新打开，读取到 5 条迁移、1 场活动，未触发迁移校验错误。

随后分别读取两库的整行数据，按主键顺序计算 JSON SHA-256：

| 表 | 源库/恢复库行数 | 两库一致的内容 SHA-256 |
| --- | ---: | --- |
| `schema_migrations` | 5 / 5 | `20297d0a45e0f74d441f2d77159d38e9757f247eccb19d5a63d5a0e57268caa5` |
| `events` | 1 / 1 | `2e5d5023eb9118650d2d7483ad5db2ad5318400761a83a91fb06dc0e6d0e6308` |
| `event_versions` | 1 / 1 | `fbef4ef0cb4924d535961618cadc23ab0ab7e7caef19e2f507af35e9444c5b6f` |
| `registrations` | 103 / 103 | `60caa9dd4d489495855d4e877a29f2839ee78ec754d1f00875956b96f2b8b286` |
| `audit` | 104 / 104 | `9dfaab786530e6b5b5edd85c397b51bfc6f58fd29727c5d607015eccc2a39d38` |

再以 `NODE_ENV=production`、恢复库 `DATABASE_URL` 和临时 `CHECKIN_SECRET` 在本机启动 API：`GET /health` 返回 200，携带 `X-Dev-User` 的 `GET /me/events` 返回 401 `UNAUTHENTICATED`，验证正式模式没有接受开发身份。本机未配置真实微信 AppID，因此没有声称完成正式登录。

局限：这里只验证单机 PostgreSQL、两独立应用连接池、逻辑归档和恢复后的数据一致性；没有验证目标托管数据库的权限、备份轮换、异地保存、恢复时间、网络断连、读副本或多应用实例故障。正式环境仍须单独演练并记录。
