# T16 `AC-OFFER-NOTIFY-FAIL` 本地证据（2026-09-26）

复用原有 offer、站内通知和外部通知发送队列。新增发送前的数据库锁与有效期检查，避免 offer 已到期而清理任务尚未运行时，继续向外部发送过时的补位邀请。

`test/notifications.test.ts` 的到期用例先于修复运行，实际外部发送次数为 1，预期为 0；修复后同一测试通过。另一个用例验证模拟提供方超时后，原 offer 仍是唯一有效席位，站内通知继续展示原截止时间与可确认状态；到期任务运行后席位释放。外部状态标记为 `UNKNOWN_REQUIRES_RECONCILIATION`，没有声称消息已送达，也不会盲目重发。

本测试使用本地 PGlite 和模拟发送适配器；真实微信订阅消息模板、提供方回执、真机展示以及生产并发仍待验证。

验证命令：`PATH=/Users/tsb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH pnpm test`，265/265 通过、0 失败；同一 PATH 下 `pnpm typecheck` 退出码 0；`git diff --check` 退出码 0。
