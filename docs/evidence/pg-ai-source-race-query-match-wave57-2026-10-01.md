# PostgreSQL AI 事实来源竞态：查询拦截修复（Wave 57，2026-10-01）

## 当前 CI 故障与原因

只读核对 [R1 CI #110](https://github.com/tony132321/miniprogram/actions/runs/36828857509)，其关联 PR #1 远端 head 为 `bc4e8022f96607cbdc230a9f9abc1eb19c256cfa`。CI 检出合并提交 `a8bb9122a8009f009bafb5ad22af155ea349ba19`，tree 为 `b8f3fa4c43d6bdd50f8b723ae51b05274fb140c1`，与关联 head 的源码 tree 一致。该记录对应本轮修复前的内容，不是修复后的远端通过证据。

`postgres-ai-semantic-race` job（ID `110260600725`）在 2026-10-01 07:11:46 UTC 退出码 1：

```text
Error: approvedAnnouncement did not lock
at scripts/verify-postgres-ai-semantic-source-race.ts:71:91
```

原脚本两处屏障要求 SQL 含有连续的 `kind='ANNOUNCEMENT' AND status='APPROVED' FOR SHARE`。当前 `src/ai-semantic-answer.ts` 的最终来源读取使用 `c.kind`、`c.status`，并在审核条件与 `FOR SHARE` 之间加入成员可读条件，因此旧屏障无法被触发。当前产品查询仍有共享锁，本轮修改验证脚本的拦截条件。

## 修复内容

`scripts/verify-postgres-ai-semantic-source-race.ts` 新增一个共用的公告来源锁匹配函数。它归一化 SQL 空白，并分别要求来源表与别名、内容/活动/版本参数、公告类型、已审核状态、作者/主办方参数、活动审核子查询标识和末尾 `FOR SHARE`。它用于定位最终加锁查询，不完整验证访问条件；访问控制仍由产品查询及相应业务测试约束。公告来源竞态与隐私锁顺序场景均使用此函数。

原有真实 PostgreSQL 断言继续保留：独立写连接实际等待锁；释放后来源发生变化；旧请求键返回 `VERSION_CONFLICT`；隐私先锁活动时没有死锁并记录已知费用；活动取消后内容写入被拒绝。没有修改产品 SQL、放宽锁断言或延长超时。

## 本机红绿验证

使用现有 PostgreSQL 18.6 二进制建立新的临时 cluster `/private/tmp/irl-pg-source-race-wave57.tXTH6X/db`，只监听 `127.0.0.1:55457`，合成角色为 `irl_wave57`。没有复用已有业务数据库。Node.js 为 24.19.0，pnpm 为 11.19.0。

修复前新建空库 `irl_r1_test_wave57_semantic_red`，探针输出：

```text
irl_r1_test_wave57_semantic_red|127.0.0.1|public|0
```

执行：

```sh
IRL_PG_TEST_URL=postgresql://irl_wave57@127.0.0.1:55457/irl_r1_test_wave57_semantic_red pnpm exec tsx scripts/verify-postgres-ai-semantic-source-race.ts
```

退出码 **1**，复现 `Error: approvedAnnouncement did not lock`，与 CI 的失败位置和原因相同。

修复后另建空库 `irl_r1_test_wave57_semantic_green`，探针同样确认地址 `127.0.0.1`、活动 schema 为 `public`、用户关系数为 0。执行：

```sh
IRL_PG_TEST_URL=postgresql://irl_wave57@127.0.0.1:55457/irl_r1_test_wave57_semantic_green pnpm exec tsx scripts/verify-postgres-ai-semantic-source-race.ts
```

退出码 **0**，完整输出：

```text
approvedAnnouncement=writer_waited_then_replay_rejected
approvedAnswer=writer_waited_then_replay_rejected
approvedAnswerTodo=writer_waited_then_replay_rejected
privacyEventFirst=nowait_rejected_no_deadlock_cost_recorded
contentEventRecheck=cancelled_before_reader_rejected
schemaVersion=71 independentConnections=2
```

`pnpm typecheck` 与这两份文件的 `git diff --check` 均退出码 0。验证后已用 `pg_ctl -D /private/tmp/irl-pg-source-race-wave57.tXTH6X/db -m fast -w stop` 停止本轮新建实例；临时 cluster 与合成红绿数据库保留在该目录供核查。

## 证据边界

本轮仅运行指定双连接脚本与静态检查，未运行全量测试，未触发或重跑 GitHub Actions，也未提交或推送。上述绿灯证明本机合成数据库中的指定行锁与重放行为；不能计为修复后的远端 CI、目标部署数据库、真实 AI 供应商、微信真机或正式发布验收通过。
