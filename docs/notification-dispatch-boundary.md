# 外部通知发送的事务边界与撤权顺序

## 当前可验证的顺序

`dispatchNotification` 先在短事务中把 `NOT_REQUESTED` 改为 `DISPATCHING`。第二个事务重新读取活动、账号、删除申请、报名、授权及适用的 offer／风控状态，并在调用适配器期间持有相应共享行锁。撤权、停用账号、删除申请、活动改版和退出报名的业务写入与这些锁冲突。因此，只要它们通过当前业务命令执行，已经完成的变更不会被随后**新开始的** `adapter.send` 越过。崩溃后再次看到 `DISPATCHING` 会转入 `UNKNOWN_REQUIRES_RECONCILIATION`，不会无条件重发。

这也意味着网络调用期间存在长事务和业务写入等待。第 49 版仍不满足工程包 `TRANSACTIONS_AND_JOBS.md` 中“外部网络调用不持有业务长事务”的要求，AC-JOBS／T18 不能标记完成。

## 为什么简单拆事务不安全

假设把最终核对放在短事务，提交后再调用提供方，即使保留租约和递增 fencing token，也允许以下执行顺序：

1. Worker 核对授权有效，写 `DISPATCHING`，提交事务。
2. 用户撤回授权的事务提交，接口返回成功。
3. Worker 才调用 `adapter.send`，启动一条新的外部发送。

把数据库核对挪到第 2 步之后，只会产生新的“最后一次核对 → 调用提供方”间隙。数据库 fencing token 只能拒绝过期 worker 的**结果回写**；现有提供方接口不接收也不执行该 token，不能撤销已开始或即将开始的网络调用。超时后若提供方是否受理未知，自动重试还可能重复发送；当前 `UNKNOWN_REQUIRES_RECONCILIATION` 必须保留。提供方幂等键可限制重复副作用，但单靠它也不能证明撤权后的发送被拒绝。`PROVIDER_ACCEPTED` 不能解释为已送达或已打开。

## 可另行设计的协调协议

PostgreSQL **session advisory lock** 可在短业务事务之外覆盖最终核对和整个提供方调用；所有使通知失效的写入事务须先获取同一锁空间中的冲突 **transaction advisory lock**，才能提交。锁可按账号、活动和全局风控域划分，但必须覆盖授权、账号状态、删除申请、活动版本／状态、报名、offer、活动安全暂停、全局开关和公开招募状态，且多锁顺序固定。恢复 worker 仍须只将未决结果转人工核对，不能重发。

这是一个需独立设计与真实 PostgreSQL 多连接池验证的方案。写入侧必须在获取业务行锁**之前**取得屏障；若在行级 UPDATE 触发器已锁住行后才获取 advisory lock，可能与先持屏障再读行的 dispatch 死锁。它虽不在网络调用期间持有业务事务，仍会让撤权、删除申请等写入等待慢速提供方；进程失联、调用超时、连接释放与旧 worker 返回都需明确处理。当前 PGlite 单会话测试不能代表这种跨进程锁协议。缺少全覆盖的写入屏障时，只给 dispatch 加 advisory lock 仍有第 2 步的竞态。本轮不以局部 lease／fence 替换现有行锁。

## 额外边界与本地证据

- `test/notification-dispatch-race.test.ts` 在 `DISPATCHING` 提交后插入撤权，验证最终核对会阻止发送；还在假设的最终核对事务提交点插入撤权，验证不会在已完成撤权后开始新的适配器调用。将适配器调用临时移到事务外的变异实验使第二条测试按预期失败，错误为 `adapter.send started after withdrawal completed`；变异未保留。
- `scripts/verify-postgres-notification-fence.ts` 在全新回环测试库上使用两个独立连接池和合成适配器，分别让撤权、停用账号、删除申请、活动改版及退出报名与正在执行的发送竞争；五种写入均在提供方调用结束前进入 PostgreSQL 锁等待，随后完成。该脚本要求 `IRL_PG_TEST_URL` 指向空的 `irl_r1_test_*` 库。
- 目前只有 `EVENT_REMINDER` 的外部用途完成配置。`WAITLIST_OFFER` 等其他用途仍返回 `PURPOSE_NOT_CONFIGURED`，不能用上述合成测试声称其真实发送已验证。
- 即使持有数据库锁，墙上时钟也会在调用期间跨过活动开始或 offer 到期时刻。最终核对只能证明**核对时**未过期；若要求提供方严格拒绝到期后的受理或投递，需要提供方支持截止时间／取消语义及相应回执。当前没有这种能力。

以上证据只覆盖本地数据库顺序和合成适配器，不构成真实微信模板、逐条订阅授权、提供方查单、送达回执或目标环境 AC-JOBS 验收。

2026-09-28 主工作树复核：`pnpm test` 在测试文件并发上限 4 的脚本下为 **512/512**，0 失败，约 251 秒；本机 PostgreSQL 18.6 全新合成库执行 `scripts/verify-postgres-notification-fence.ts` 退出码 0，两个连接池的五种竞争均进入预期锁等待并安全完成。此前无限定并发的一次本机测试曾出现 Node V8/WebAssembly 进程崩溃，相关文件单独通过；旧 GitHub CI 亦有一次未稳定复现的原生进程崩溃。因此测试脚本显式限制同时运行的文件数为 4，尚不能据此确定底层崩溃根因已消除。
