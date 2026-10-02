# 邀请分享与期限变更：CI 定向测试对齐（Wave 57，2026-10-01）

## 失败来源与范围

只读检查 [R1 CI #110](https://github.com/tony132321/miniprogram/actions/runs/36828857509)，远端 head 为 `bc4e8022f96607cbdc230a9f9abc1eb19c256cfa`。`checks` job（ID `110260600590`）的 Test 步骤退出码 1，原自动执行结果为 1157/1163 通过、6 项失败。本记录仅负责其中两项邀请相关失败；不将其定向通过解释为修复后的全量或远端 CI 通过。

| 原失败用例 | 本机修复前复现 | 根因 |
| --- | --- | --- |
| `event page refuses an invitation card while the current version awaits review`，`test/invite-miniapp-share.test.ts:33` | 退出码 1，期望分享意图计数 1，实际 0 | 已有产品分享检查要求服务器确认的 `inviteRemainingMs`、页面本地有效期和 `READY` 状态；旧 fixture 未提供这些条件，导致已审核分支也被正确拒绝。 |
| `changing registration deadline keeps the invitation expiry aligned with the current activity`，`test/lifecycle.test.ts:351` | 退出码 1，期望返回原邀请令牌，实际 `undefined` | `registrationDeadline` 属于重大变更，审核后招募仍暂停；已有 `getEvent` 有效期检查会隐藏此时不可使用的邀请令牌。数据库仍保留令牌并更新到期时间。 |

相关产品有效期检查来自既有提交 `0820e39`。本轮修改两份测试，产品代码保持现有有效期、审核和招募门槛。

## 修复后的断言

分享 fixture 加入 `READY`、招募状态、60 秒服务器有效期和当前页面的有效期边界。测试继续要求待审核时不发送分享意图、显示拒绝信息、分享路径回到首页；仅改为已审核后，分享意图计数为 1，路径包含原邀请令牌。

期限变更测试对延长、缩短两种截止时间继续逐次检查数据库到期时间，并直接检查持久化邀请令牌未变；同时要求已审核但招募暂停时 API 隐藏令牌、有效期为 0。没有删除原数据库到期时间断言。

## 定向红绿命令与结果

运行环境：本机 Node.js 24.19.0，实际页面代码在 VM 中执行，生命周期测试使用新建内存数据库与真实业务函数。

修复前，两条命令分别退出码 1，并复现上述同一断言错误：

```sh
node --import tsx --test test/invite-miniapp-share.test.ts
node --import tsx --test --test-name-pattern='changing registration deadline keeps the invitation expiry aligned with the current activity' test/lifecycle.test.ts
```

修复后：

```sh
node --import tsx --test test/invite-miniapp-share.test.ts test/miniprogram-event-post-refresh-race.test.ts
# tests 5, pass 5, fail 0, exit 0

node --import tsx --test --test-name-pattern='changing registration deadline aligns stored invite expiry and hides the paused invitation' test/lifecycle.test.ts
# tests 1, pass 1, fail 0, exit 0
```

前一条命令同时保留四个已有跨活动、跨会话的异步结果隔离回归，验证有效的分享 fixture 不会取消这些行为门槛。

`pnpm typecheck` 与本轮两份测试的 `git diff --check` 均退出码 0。

## 证据边界

本轮未运行全量测试，未触发或重跑 Actions，未操作模拟器，未提交或推送。结果仅证明上述本机定向用例；旧 CI 其余失败与修复后远端执行状态须另外核对。
