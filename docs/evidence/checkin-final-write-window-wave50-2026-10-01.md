# RQ13 扫码签到最终写入时钟

`checkIn` 原先在事务前段按数据库时间验证活动窗口与 60 秒动态口令，最终 `INSERT INTO checkins` 没有再次校验。若请求在校验后停顿到窗口或分钟桶过期，仍会写入 `SCAN`，`checked_at` 还保留较早的预检时间。

新增 `test/checkin-final-write-window.test.ts`。先在最终插入前做短暂受控延迟、另以受控预检时钟模拟过期分钟桶：两项旧行为均错误地成功写入，测试 **0/2**。修复后，最终插入在数据库的同一个时点计算活动窗口与口令分钟桶，并用该时点写 `checked_at`；两项失败路径均不留签到行或 `CHECK_IN`／`EVENT_STARTED` 审计，测试 **2/2**。显式传入测试时钟的既有函数调用仍沿用该时钟。

相邻生命周期签到定向 **7/7**、HTTP 扫码及签发定向 **3/3**；`tsc --noEmit` 与 `git diff --check -- src/lifecycle.ts` 通过。生产调用不传测试时钟，最终判断以数据库时钟为准。

随后把同一份定向测试扩展为可选的 `IRL_PG_CHECKIN_TEST_URL` 本机 PostgreSQL 路径，并新增有效窗口内实际写入一条 `SCAN` 的正向用例；测试数据库 URL 限制为 `127.0.0.1`、`irl_r1_test_*` 名称。新建独立空库 `irl_r1_test_checkin_write_wave50_1790829382586`，本机 PostgreSQL 18.6 上完成迁移后，正向写入、最终写入前窗口关闭、动态码分钟桶过期三项 **3/3**；PGlite 同三项 **3/3**，类型检查退出 0。正向回读一条 `SCAN` 且 `checked_at` 接近数据库写入时刻；两项拒绝路径均无签到和对应审计。未运行全量测试、微信开发者工具、真机或目标部署环境 PostgreSQL。
