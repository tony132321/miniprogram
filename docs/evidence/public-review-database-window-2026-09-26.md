# RQ19 公开活动审核窗口由数据库裁定

受控公开活动原先用应用进程时间判断审核员能否通过待审活动，最后的审核状态更新没有再次核对时间。现在 `APPROVED` 在事务中先读取数据库时间，再在最终 `UPDATE ... RETURNING` 检查：仍招募中的活动必须早于成局确认截止；已成局活动必须早于开始时间。窗口已关闭时保持 `PENDING`、不开放招募、无审核决定记录；`REJECTED` 不受通过审核的窗口限制。

先新增两个测试并确认旧实现失败：数据库时间已越过窗口而应用时间仍早；窗口在最终写入前关闭。每项覆盖 `RECRUITING` 和 `CONFIRMED`。修复后全量 `pnpm test` 为 332/332，`pnpm typecheck` 和 `git diff --check` 通过。

微信开发者工具 0.3.11 接入本地开发 API：测试访客在审核前无法打开活动；运营测试身份通过本地 HTTP 审核后，同一小程序页面刷新为 `READY`、`reviewStatus=APPROVED`、`recruiting=true`、`canJoin=true`。[模拟器截图](wechat-public-review-db-clock-2026-09-26.jpg)。模拟器身份已恢复 `host`。此验证不是实际人工资质审核、真机或正式运营值守。
