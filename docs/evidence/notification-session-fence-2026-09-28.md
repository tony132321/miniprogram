# 第 51 版通知发送会话屏障：本地验证

环境：2026-09-28，macOS，本地 PGlite 与回环 PostgreSQL 18.6；测试库名称均以 `irl_r1_test_` 开头。分支 `codex/notification-fence-r1`，合成适配器，没有真实微信消息发送。

## 执行结果

- 主工作树合并第 51 版、禁发补强与串行测试缓解后，`pnpm test` **524/524**、`pnpm typecheck` 通过；这是本机合成测试，远端新提交的 CI 尚待验证。

- `pnpm typecheck`：退出码 0。
- `pnpm test`：516/516，通过；新增红绿用例先在旧实现中失败（提供方调用持有开放事务，独立读取在 250 ms 内不能完成），第 51 版改动后通过。
- 空库 `irl_r1_test_full51_20260928_d` 执行 `scripts/verify-postgres.ts`：退出码 0；51 次迁移、两连接池、100 名竞争最后席位及脚本报告的生命周期／隐私／运营竞态通过。该次在顶层受护 SQL 与嵌套锁槽修正后执行。
- 空库 `irl_r1_test_fence51_20260928_d` 执行 `scripts/verify-postgres-notification-fence.ts`：退出码 0。三连接池（两应用池加一个原生 SQL 池）、11 张受护表触发器、8 种写入竞争均经过 PostgreSQL advisory 锁等待；发送时 `pg_stat_activity` 无未提交业务事务。claim 已提交而尚未最终复查时撤权，适配器调用次数 0。已发送通知回到 `NOT_REQUESTED` 的直接 SQL 被触发器拒绝。故意保持适配器约 200 ms 时，另一活动的版本写入等待 **205 ms**。
- 从已有已填充第 50 版库复制到 `irl_r1_test_fence51_upgrade_20260928_a` 后执行 `scripts/verify-postgres-notification-fence-upgrade.ts`：退出码 0。双应用池并发启动完成 50→51 迁移，保留 **463** 条通知的状态／提供方引用与 **501** 个任务，11 张表的触发器均安装，历史已受理通知不能重置成未请求。

## 审查补强复验

- 定向执行 `tsx --test test/notification-dispatch-race.test.ts test/notifications.test.ts test/notification-contract.test.ts`：**32/32**，退出码 0；`pnpm typecheck`：退出码 0。缺用户、缺报名、候补、旧接受版本、活动已开始、授权 scope 变化，以及 claim 后接收方变化，均以适配器调用 0 次和持久化禁发状态验证；当前版本的参与主办方仍可收到合成提醒。本地门闩嵌套调用会立即拒绝，不等待自己的锁。
- 空库 `irl_r1_test_full51_review_20260928_c` 执行 `scripts/verify-postgres.ts`：退出码 0。隐私删除与合成发送竞争的夹具仅将活动推进到 `CONFIRMED`；其主办方由发布动作生成当前版本的 `CONFIRMED` 报名，账号存在且已授权，保持真实外发资格检查。
- 空库 `irl_r1_test_fence51_review_20260928_b` 执行 `scripts/verify-postgres-notification-fence.ts`：退出码 0。原有三连接池、8 种受护写入竞争与 claim 间隙撤权继续通过；增加原生 SQL 在 claim 后修改通知 detail，适配器调用 0 次并记录 `STALE_STATE`。另一活动的受护写入等待 **218 ms**，仍显示全局屏障的吞吐代价。

## 可得结论与边界

第 51 版在合成适配器和本地数据库下，外部调用不再持有业务事务；当前 11 张表的写入在发送开始前后按屏障排序，旧 worker 的结果回写需匹配随机 token。`PROVIDER_ACCEPTED` 仍只代表提供方受理。

屏障是全局的：即使写入另一活动，只要操作触及受护表，仍等待慢速提供方；连接池最多允许 4 个待发送会话占用 12 个连接。10 秒 `AbortSignal` 需要真实适配器遵守并结束 Promise，才能限制等待。若数据库会话在外部调用中断开、提供方无法取消、时钟跨过活动开始／offer 截止，数据库本身不能禁止已经在途或随后由提供方执行的发送。目标环境的数据库角色限制、真实微信模板／逐条订阅、提供方查单、连接故障和真机验收尚未完成，因此不把本地结果写成完整 AC-JOBS 或上线通过。
