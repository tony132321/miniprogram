# PostgreSQL 子进程崩溃与重启恢复（2026-09-29）

范围：v3.1 `AC-OUTBOX-COMMIT-CRASH`、`AC-RECOVERY` 的**本机工程验收**。脚本 `scripts/verify-postgres-process-crash.ts` 只连接回环地址，自动新建并验证空的 `irl_r1_test_*` 数据库，迁移到第 66 版；仅对自己启动的子进程发送 `SIGKILL`，不会停止开发者工具、用户服务或 PostgreSQL 主进程。测试库保留，便于回读。

执行：

```sh
pnpm exec tsx scripts/verify-postgres-process-crash.ts
node --import tsx --test --test-concurrency=1 test/jobs-recovery.test.ts test/notifications.test.ts
pnpm typecheck
```

本机 PostgreSQL 18.6 第二次完整演练使用 `irl_r1_test_process_crash_1790673789808_3156d1`，脚本退出码 0。相关单元／域测试 **27/27**，类型检查退出码 0。测试驱动阶段先观察到子进程入口缺失导致脚本失败，再补子进程入口并完成演练；第一次完整演练与补充最终断言后的第二次演练均通过。

| 故障注入和权威回读 | 结果 |
| --- | --- |
| 子进程调用真实 `register` 并提交报名、审计、站内通知和 `SEND_EXTERNAL` 作业后，立即杀掉该生产者。父进程从另一连接查询。 | 报名 `CONFIRMED` 一条、通知 `NOT_REQUESTED` 一条、作业 `PENDING` 一条、报名审计一条。用户无需重复点击报名。 |
| 另一 worker 真实领取作业并写入 `PROCESSING`、`claim_token` 和尝试次数，在确认前被杀。将**测试库**租约时间拨到六分钟前，启动新 worker 进程。 | 新进程领取过期作业并落 `DONE`，尝试次数 2，令牌清空；重复启动时处理数 0；报名、通知和审计均只有一条。该报名通知因尚无正式外部模板，明确落 `PURPOSE_NOT_CONFIGURED`，站内通知保留。 |
| 创建真实预留后，将**测试库**预留和到期作业拨到过去，启动新 worker；之后继续报名直到满额。 | 预留写入 `released_at`；4 个确认席位和 1 个候补，没有超额确认。 |
| 为合成成员授权活动提醒，合成适配器在调用时将一次调用写入测试库，然后暂停；杀掉持有外发栅栏的 worker。将**测试库**作业租约拨到过去，启动新 worker。 | 提醒从 `DISPATCHING` 转为 `UNKNOWN_REQUIRES_RECONCILIATION`，失败类别 `INTERRUPTED_DISPATCH`；作业 `DONE`、尝试次数 2；适配器调用记录始终 1 条，重启未盲目再发。 |

脚本输出：

```json
{"database":"irl_r1_test_process_crash_1790673789808_3156d1","schemaVersion":66,"registrationCommittedBeforeCrash":true,"registrationOutboxRecoveredAfterLeaseExpiry":true,"registrationAuditRows":1,"registrationNoticeRows":1,"confirmedSeats":4,"waitlisted":1,"expiredReservationReleased":true,"syntheticProviderCallsAfterRestart":1,"interruptedExternalStatus":"UNKNOWN_REQUIRES_RECONCILIATION","actualProviderDeliveryProven":false}
```

`.github/workflows/r1-ci.yml` 新增独立 `postgres-process-crash` 作业，提交后需以远端 CI 结果确认。这个演练使用合成适配器和人为拨动**测试库**租约，不证明真实微信消息送达，也不证明生产部署故障恢复时间、多实例网络分区或目标环境的恢复操作；这些仍需真实资源和运行环境验收。
