# 历史主办活动任务字段盘点回归（2026-10-01）

`inspectPrivacyFields` 原先只按 `jobs.payload.userId` 关联本人，遗漏只含 `{"version":1}`、通过 `jobs.event_id` 关联本人主办活动的生命周期任务。现保留顶层 `userId` 条件，并通过既有 `historicallyHosted` 谓词计入本人历史主办活动的任务；字段清单新增非空 `jobs.event_id` 计数。删除申请后的主办墓碑映射仍可追溯，普通成员不会继承他人主办活动的任务。

定向回归在隔离数据库里放入本人主办任务、本人仅作为普通成员参与的活动任务、完全无关的活动任务，以及原有 `payload.userId` 任务。修复前，该测试按预期以 `jobs.payload` 计数 `1 !== 2` 失败；修复后本人在删除前后均为 `payload=2`、`event_id=1`，其他主办人的两场活动为 `payload=2`、`event_id=2`。受限影响清单与删除 dry-run 的字段盘点保持一致，未返回任务正文或标识值。

`node --import tsx --test test/privacy-field-inventory.test.ts` **4/4 通过**；`tsc --noEmit` 与本批 `git diff --check` 退出 0。未运行全量测试、生产数据库或外部副本盘点。本清单仍只表示固定字段的非空行数，不代表字段本身均为个人信息，也不作删除或保留决策。
