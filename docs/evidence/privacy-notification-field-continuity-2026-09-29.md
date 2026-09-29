# 通知到期后字段盘点的归属连续性（2026-09-29）

范围：`AC-PRIVACY`、`AC-DATA` 的本地合成验证。普通资料到期后，通知接收人会从原用户 ID 改为申请绑定的 `deleted:notification:` 墓碑；通知行的提供方元数据和运营跟进备注继续按待复核类别保留。原字段盘点只按原用户 ID 查通知与跟进记录，因此到期后少报这些仍保留的字段。

`src/privacy-field-inventory.ts` 现按 `privacy_ordinary_profile_expiries` 中的申请、原用户和通知墓碑映射，继续计入该申请人的通知及跟进字段。字段盘点只返回固定字段的非空行数，不返回提供方引用、备注或通知正文。既有影响清单 `counts.notifications` 仍表示原用户 ID 当前直连的通知行数；`ordinaryProfileDisposition.retainedNotificationRows` 表示墓碑接收人的保留通知行数。

回归 `test/privacy-field-inventory.test.ts` 建立一名申请人、一名其他用户，以及各自的通知和运营跟进记录；先核到期前字段数，再执行删除保护和到期处置，核到期后申请人的提供方引用与跟进备注仍各计 1，其他用户各计 2，dry-run 与受限影响清单一致且不泄露原值。新测试在修复前以通知 `provider_ref` 数量 `0 !== 1` 失败；首次修复后该文件 3/3，隐私相关定向合跑 6/6，`pnpm typecheck` 与 `git diff --check` 通过。

同轮最小扩展补入 `offers.registration_id` 和 `offer_status_history.offer_id` 两个结构化关联字段。归属关系复用既有影响清单的 `offer → registration → user`，删除后经每场活动的墓碑映射追踪。另一条合成回归为申请人建立一条候补邀请，为其他用户在两场活动建立两条；修复前字段不存在（`undefined !== 1`），修复后删除前后申请人各计 1、其他用户各计 2，且不返回记录 ID。扩展后的字段清单测试 4/4、隐私相关定向合跑 7/7、`pnpm typecheck` 与 `git diff --check` 通过。增强区分度前的合并候选全量 `pnpm test` **666/666**、0 失败；增强后字段清单定向 **4/4**、类型检查通过，远端全量以新提交的 CI 为准。

后续同范围补入 `registration_status_history.registration_id` 与 `event_status_history.event_id`。两者复用影响清单已使用的报名归属和历史主办归属查询：前者按申请人与其他用户的报名历史区分归属，后者按不同主办的活动历史区分归属。增加删除前后断言时，两项先因字段缺失分别以 `undefined !== 1` 失败；补入固定字段清单后，申请人删除前后各计 1，其他用户经额外合成记录各计 2。此项只计结构化关联字段，不把整条历史记录或其他字段推断为可删数据。

此验证使用 PGlite、合成策略和合成用户。它只补齐上述通知墓碑与四个结构化关联字段；清单仍是选定字段的非空行数，不能证明不透明 JSON、外部提供方副本、生产备份、真实策略批准或全部个人信息的最终处置。
