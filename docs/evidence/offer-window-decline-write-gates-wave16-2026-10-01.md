# RQ08/T16 候补窗口与拒绝动作最终写入门控（2026-10-01）

范围：v3.1 `AC-OFFER-WINDOW`、`AC-OFFER-DECLINE`。沿用现有活动行锁、FIFO、事务、站内通知与幂等机制；只改 `src/registrations.ts` 和 `test/registrations.test.ts`。

## 复现与修复

- `promote()` 原先只在候补循环开头读取一次数据库时间。该读取显示仍有至少五分钟时，后续无条件把候补改为 `OFFERED` 并插入 offer；检查与插入之间跨入最后五分钟也会发出邀请。新增 PGlite 定向测试让较早的时间读取落在窗口外，而最终 SQL 使用当前数据库时间。修复前失败：实际报名状态 `OFFERED`，预期 `WAITLISTED`。
- 现在先用 `INSERT ... SELECT ... FROM events ... RETURNING` 在插入 offer 的同一 SQL 中要求当前数据库时间距报名截止不少于五分钟。插入失败时保留 `WAITLISTED`，不给成员生成 offer／通知／过期任务，并沿用每活动版本去重的主办方 `WAITLIST_WINDOW_CLOSED` 站内待办。插入成功后才将候补置为 `OFFERED`，相关写入仍在同一事务内。
- `declineOffer()` 原先检查令牌未到期后，无条件把 offer 改为 `DECLINED`。新增定向测试在最终 UPDATE 前使令牌过期。修复前失败：请求没有抛出预期的 `OFFER_UNAVAILABLE`。现在最终 UPDATE 自身要求 `status='ACTIVE'` 且 `expires_at>clock_timestamp()`；零行更新触发事务回滚，不改变报名、FIFO 或通知。

## 拒绝操作的活动门控

拒绝是放弃已有占位。v3.1 `AC-OFFER-DECLINE` 的既有验收证据明确要求风险暂停期间仍可拒绝、暂停解除后再顺延；因此不能照搬接受操作的 `recruiting=true`／活动状态门控。正常生成的 offer 到期时间取 `min(生成时刻+15 分钟, registrationDeadline)`，自然越过报名截止时，最终写入处的 `expires_at>clock_timestamp()` 已拒绝该 offer。`registrationDeadline` 属于重大活动变更；`changeEvent()` 在持有同一活动行锁的事务中取消 ACTIVE offer 并把 OFFERED 报名退回 WAITLISTED，取消活动也取消 ACTIVE offer。`declineOffer()` 先锁活动并核版本，再锁 offer，因此正常活动变更与拒绝会串行，旧版本或已取消 offer 不会被拒绝成功。没有为拒绝最终 UPDATE 追加活动招募状态／截止条件，也没有为既有门控重复添加测试。

若绕过服务接口直接改库，留下 `expires_at` 晚于当前 `registrationDeadline` 的异常历史 offer，上述不变量不再成立；应作为数据迁移／修复场景单独核查，不能据此声称当前路径已经覆盖异常历史数据。

## 定向验证

使用 `/Users/tsb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --import tsx --test --test-isolation=none --test-concurrency=1`：

- 新增的两条测试分别先在旧实现上失败，修复后合跑 **2/2 通过**。
- `test/registrations.test.ts` **30/30 通过**。
- `test/notifications.test.ts` 中 offer／拒绝／候补相关 **6/6 通过**。
- `test/metrics.test.ts` 中 offer 状态历史相关 **2/2 通过**。
- `git diff --check -- src/registrations.ts test/registrations.test.ts` 通过。
- 并发编辑期间 `tsc --noEmit` 曾被另一测试文件的中间态类型错误阻断；该文件修正后，根任务重跑 `pnpm typecheck` 退出码 0。

SQL 使用 PostgreSQL 已支持且本仓库现有路径使用的 `INSERT ... SELECT ... RETURNING`、`UPDATE ... RETURNING`、`timestamptz`、`interval` 与 `clock_timestamp()`。上述 PGlite 定向测试实跑了两条新写入语句。本机没有可调用的 `psql`／`pg_ctl`，也未设置 `DATABASE_URL`；此次没有声称真实 PostgreSQL 双连接池或目标环境验证。测试时间差由查询边界注入，验证最终写入时间门控，不模拟真实等待或真机通知送达。未跑全量测试、未提交或推送。
