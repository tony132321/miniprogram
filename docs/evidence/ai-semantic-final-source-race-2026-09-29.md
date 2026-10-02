# RQ11/RQ20：事实问答来源竞态与旧键重放（2026-09-29）

本轮沿用原有 `askCurrentFact`、`askSemanticCurrentFact`、人工审核和数据库事务。账号、活动、模型回执及 PostgreSQL 数据库均为合成测试数据；生产语义模型仍关闭。

## 故障与修复

原语义路径先确认已审核公告，另开事务保存答案。测试屏障证明，公告随后被驳回、活动版本改变，或已审核回答在同版本被去标识时，旧实现仍可能写入或重放过期正文。异步完成函数未被 `await` 时，第二次来源竞争还会留下 `STARTED`，漏记已观察到的模型费用。

保存事务现按公告或回答内容、事实待办、活动的顺序锁定并复查来源、成员、可见版本与活动状态。活动锁用 `FOR SHARE NOWAIT`：隐私清洗若已先锁活动，不会与先锁内容的答案事务互相等待；本次结果返回 409，费用以可核对状态持久化。来源已变更时改用新的规则问答键重新读取；第二次仍变更则拒绝结果。`CURRENT_EVENT` 来源也在最终保存时对照当前字段，防止同版场地清洗后返回旧场地。

直接规则问答原先由 `command()` 在命中旧键时跳过业务逻辑。现在即使重放，也会在事务内重新确认账号、活动成员、版本、状态，以及相应当前活动字段、已审核回答、已审核公告或本人待办；问题文本在读取缓存前校验。语义问答重放同样重新核对已审核来源，并验证公告问题仍与提问相符，即使新旧答案文字碰巧相同也不能复用不相关问题。上述回归均先在旧代码复现预期失败，再修复通过。

## 本机验证

定向命令 `pnpm exec tsx --test test/ai-semantic-answer.test.ts`：**30/30** 通过；`pnpm typecheck` 与 `git diff --check` 退出码为 0。合并发现页修复后的最终候选本机 `pnpm test` **686/686** 通过，失败、跳过均为 0。

本机 PostgreSQL 18.6 在新建空库 `irl_r1_test_semantic_final_20260929_a1` 完成第 66 版迁移后，执行：

```text
IRL_PG_TEST_URL=postgresql://tsb@127.0.0.1:55432/irl_r1_test_semantic_final_20260929_a1 pnpm exec tsx scripts/verify-postgres-ai-semantic-source-race.ts
```

退出码 0。独立写连接分别在已审核公告、已审核回答和回答待办的 `FOR SHARE` 锁上实际等待；释放后更新来源，同键旧答案均被 409 阻断。另验证隐私清洗先取得活动写锁时，语义事务 `NOWAIT` 返回版本冲突、无死锁并记录已知 5 分成本；同版活动状态写入先持锁时，内容写入等待，活动取消后拒绝创建。脚本输出含：

```text
approvedAnnouncement=writer_waited_then_replay_rejected
approvedAnswer=writer_waited_then_replay_rejected
approvedAnswerTodo=writer_waited_then_replay_rejected
privacyEventFirst=nowait_rejected_no_deadlock_cost_recorded
contentEventRecheck=cancelled_before_reader_rejected
schemaVersion=66 independentConnections=2
```

另一份[活动详情读锁演练](postgres-event-read-lock-2026-09-29.md)单独证明同版本活动正文清洗会等待详情读事务结束。语义双连接脚本已纳入 `.github/workflows/r1-ci.yml`；最终远端执行状态以该提交的 Actions 结果为准。

这些结果证明本地业务分支和指定 PostgreSQL 行锁行为，不代表真实 AI 供应商、目标部署数据库、正式微信账号或真机。旧数据的实际保留与删除仍须按照获批策略执行；阻止旧请求键回显不等于完成全部数据清理。
