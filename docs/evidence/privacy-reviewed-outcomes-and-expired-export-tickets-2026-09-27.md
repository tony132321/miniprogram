# 本人争议裁决与短时导出凭证清理（2026-09-27）

范围：在既有个人导出、运营删除影响清单和后台维护循环上补齐明确可归属的记录；不改用户资料或争议记录的保存期限，不执行注销或删除请求。

- 本人提交的到场争议若已形成 `outcome_reviews`，个人导出加入对应举报 ID、活动 ID、裁决与时间。关联依据是 `reports.reporter_id`；不导出运营内部 `reason` 或 `reviewed_by`，其他成员也读不到该举报的裁决。主办人已有的活动裁决导出保持独立。
- 受 `PRIVACY` 权限保护的删除影响清单新增主办活动裁决、本人举报裁决的分别计数。运营工作台的请求行现展示两个计数；缺失字段显示“—”而非虚假的零。清单仍标记为 `SELECTED_CATEGORIES_ONLY`，计数不能代替逐用途删留判断。
- `personal_export_tickets` 的链接在 10 分钟后已拒绝下载。维护循环在过期后保留 24 小时，以便本人使用过期链接时继续收到原有的 410 `EXPORT_EXPIRED` 与“请重新生成”提示；超过这段诊断保留期的票据行按数据库时钟删除，此后相同路径返回 404。清理票据时只连带清除该本人、该票据路径、`personal-export-ticket` 路由的幂等重放结果，其他路由不受影响。保留期间票据依旧不能下载数据，未到期票据不受影响。超过保留期后复用旧幂等键可重新签发一个新票据；清理前同键仍重放原结果。这里的 24 小时是错误恢复窗口，不代表个人数据保存期限已经获批准。

测试采用本地合成数据。先运行 `pnpm exec tsx --test test/privacy-export.test.ts test/privacy-impact.test.ts`，观察到导出字段缺失、两个影响计数缺失；随后添加到期凭证测试，观察旧行仍在。运营 DOM 测试先观察到新增计数不显示。补实现后运行 `pnpm exec tsx --test test/operator-ui.test.ts test/privacy-export.test.ts test/privacy-impact.test.ts test/outcome-review.test.ts test/jobs-recovery.test.ts`：50/50 通过；`pnpm typecheck` 通过。这里的后台循环验证使用 PGlite，不等于生产 PostgreSQL 的实际定时运行或目标部署验收。

独立审查发现即时删除到期票据会把本人原本的 410 响应变为 404。新增 HTTP 与维护组合回归后，首次定向测试 0/2 通过：HTTP 实得 404，维护循环过早删除刚到期行。调整为 24 小时诊断保留后，同一命令 `pnpm exec tsx --test --test-name-pattern='personal export ticket|background maintenance retains' test/api.test.ts test/privacy-export.test.ts` 为 2/2 通过；测试同时确认两天前过期的行已清除。

随后新增旧幂等键重用回归：修复前定向测试 0/1 通过，证明旧票据虽已删除，`idempotency.result` 仍含旧路径。合并清理后运行 `pnpm exec tsx --test --test-name-pattern='personal export ticket|background maintenance retains|old personal export replay credentials' test/api.test.ts test/privacy-export.test.ts`：3/3 通过；同时验证其他路由的幂等记录不被清除、旧键重新签发得到不同路径。

仍待外部资源与政策：负责人批准用途级保存期限和争议隔离依据、真实删除/去标识执行、备份轮换及恢复后删除标记重放。短时导出凭证清理只处理过期访问凭证，不宣称满足 T32 的完整数据生命周期验收。
