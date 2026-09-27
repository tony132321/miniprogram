# 本地 PGlite 备份恢复演练（2026-09-24）

范围：已停止 API 的 `.data/review-smoke` 测试库。备份和恢复文件均在被 Git 忽略的 `.data/` 内。使用 `scripts/local-backup.ts`，从已有 PGlite 数据目录导出 gzip 归档，恢复到全新目录后由 `createDatabase` 重新核对迁移校验值。

执行命令：

```text
pnpm exec tsx scripts/local-backup.ts backup .data/review-smoke .data/rehearsal-2026-09-24.tgz
pnpm exec tsx scripts/local-backup.ts restore .data/rehearsal-2026-09-24.tgz .data/rehearsal-restored
```

归档为 4,884,396 字节，SHA-256 为 `eee93a5518d575766be0797aa24b7f5d5350824866664b231330872d548869fb`；恢复命令返回 `verified: true`。随后分别只读查询源库与恢复库，对每张表按完整行内容排序后计算 JSON SHA-256：

| 表 | 源库/恢复库记录数 | 内容 SHA-256（两库一致） |
| --- | ---: | --- |
| `events` | 1 / 1 | `17138bfa4bd99ba8c559ec5290fe1664621ebbc4b6cd2e999f4de888a4e5d0a8` |
| `registrations` | 2 / 2 | `baedc73a694de17096899a1e6cad87cb1493a61e3048e12d809898f3a5f862fa` |
| `audit` | 5 / 5 | `f19214d8a6adf6cf4204451ab46c5b8d1fb5b00f3954fad018369ce2275de4b4` |
| `schema_migrations` | 5 / 5 | `2e07ab7fd77fadfdde5c732f4cdcc963260572535e1271b912bacca774985a4d` |
| `event_review_decisions` | 1 / 1 | `ff42fb6e0cd929d1281c56f0e8df278ce829a0483d0c26b01653a8e3ec5f02ab` |

自动化测试另覆盖备份目标已存在、恢复目录已存在、损坏归档和空数据目录。此证据只覆盖本机 PGlite；尚未配置真实 PostgreSQL，因此不构成生产备份、异地存储、恢复时间或备份轮换验收。
