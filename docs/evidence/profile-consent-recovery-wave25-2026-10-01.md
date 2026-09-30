# 个人页授权未知结果恢复审查（2026-10-01）

审查范围：`pages/me/me.js` 的活动提醒与类似活动候选授权，`utils/api.js` 的未知结果幂等键，以及服务端 `/me/consents`、`/me/similar-invites` 契约。

## 发现与处理

- API 将未知结果的幂等键持久化；个人页原先仅在内存保留待核对操作。应用重启后，用户可以在旧键仍在的情况下撤回再授权。最后一次授权会回放旧成功结果，而服务端实际保持撤回状态。现在授权请求发送前按用户保存操作意图及原始 payload，重启和同用户令牌轮换后锁定开关，要求显式核对同一次操作。
- API 在确定的 2xx 响应后释放旧键。个人页现在读取服务端授权状态后才显示成功；若读取值与提交目标不一致，保留服务端状态并提示用户再次明确操作，不自动发相反请求。
- 显式退出登录会清理该用户尚待核对的页面恢复记录；普通令牌轮换保留记录。旧令牌回调由内存操作对象和身份比较隔离，不能清理新会话恢复操作。

## 验证

- 红测先复现了重启旧键回放、确定成功但 GET 回读相反值、显式退出遗留恢复记录；修复后转绿。
- `node --import tsx --test --test-concurrency=1 test/miniprogram.test.ts test/miniprogram-caper-profile-visual.test.ts test/miniprogram-profile-resilience.test.ts test/miniprogram-profile-notice-display.test.ts test/miniprogram-profile-mutation-session.test.ts`：132/132 通过。
- `node node_modules/typescript/bin/tsc --noEmit` 与 `git diff --check`：通过。
- 本轮未运行全量测试或微信开发者工具交互；真实微信登录和外部授权服务仍需对应环境验收。
