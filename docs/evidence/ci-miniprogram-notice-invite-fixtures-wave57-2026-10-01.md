# 旧 CI 的邀请码与个人通知夹具对齐（Wave 57，2026-10-01）

范围：旧 CI run `36828857509` 中 `test/miniprogram.test.ts` 的三处失败，原断言位置为 48、804、832。此次仅修改该测试文件的三个场景，不修改产品代码、放宽入口条件或删除原行为断言。

## 定向复现与根因

先在当前工作区执行以下命令，得到 **0/3 通过、3 条失败**，分别是邀请目标缺失、账号通知提示为空、取消通知详情目标缺失，与交接的旧 CI 失败一致：

```sh
node --import tsx --test --test-name-pattern='R1 discovery has no active public-search|opening an account-wide notice|failed detail navigation leaves a cancellation' test/miniprogram.test.ts
```

发现页已使用 32 位 `[A-Za-z0-9_-]` 邀请口令；原测试输入 `abc123`，入口按现有规则拒绝。个人页 `openNotice` 要求通知列表为 `READY`，并从当前已加载列表匹配通知 ID、种类和活动 ID；原两条通知测试直接在 `IDLE`、空列表上构造点击参数，因此在导航或标已读前被正确拒绝。

## 夹具修正与断言保留

- 邀请场景先断言短口令停留在发现页并提示 32 位格式，再输入带首尾空格的有效 32 位口令，继续断言邀请详情与发起 Tab 的准确目标。
- 账号通知场景通过真实 `page.refresh()` 从 API 夹具载入一条 `event_id=null` 的本人通知，使用固定当前会话存储；继续断言不会跳到缺失活动且显示“通知已打开”，另补确切标已读 POST 和刷新后 `OPENED` 状态回读。
- 取消通知场景同样先通过真实刷新载入当前会话通知，保留失败前零标已读、详情导航失败后仍未读和错误提示、重试导航成功后才 POST 标已读的全部原断言。产品的当前身份、已加载行匹配与导航顺序保护保持执行。

## 本地验证

修正后重跑上述三项：**3/3 通过**。

另定向检查相关的有效邀请入口、扫描格式及账号切换、旧邀请码清理、伪造／旧通知卡拒绝、导航失败不标已读：

```sh
node --import tsx --test --test-concurrency=1 --test-name-pattern='closed public-search entry|discovery scans only|invitation entered by|profile rejects forged|profile notice remains unread' test/miniprogram-discover-actions.test.ts test/miniprogram-profile-notice-display.test.ts
```

结果 **5/5 通过**。执行时使用本机打包 Node `/Users/tsb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node`；`git diff --check -- test/miniprogram.test.ts` 退出 0。

本次 `node node_modules/typescript/bin/tsc --noEmit` 退出 1，错误在并行任务的 `test/miniprogram-caper-pg02c-host-cover.test.ts`：第 67 行 TS2769（`string | undefined` 不能传给 `string` 参数）、第 69 行 TS2532（对象可能为 `undefined`）。本子任务已反馈主代理，未修改该文件；不得把这一轮全局类型检查记为通过。

未运行全量测试、重新触发 CI、操作微信开发者工具、提交或推送。本记录仅支持三条旧夹具失败的定向修正及相邻入口保护的本地验证，不代表当前候选全量或修复后远端 CI 已通过。
