# v3.1 全局新增止损验证（2026-09-25）

来源：开发包 T29 的 `AC-SAFETY`、`AC-RELEASE-STOP` 可在本机执行的部分；沿用已有公开招募开关、活动锁、持久任务、运营 `SAFETY` 权限和审计表。第 24 版迁移增加独立 `emergency_gate`，默认开放。受权安全运营可填写原因暂停或恢复；每次状态变化都记录操作者、原因和数据库时间。面向小程序的 `/system/safety` 只返回状态和时间，不返回内部核查原因。

关闭时，服务端阻止新建草稿、发布、邀请轮换、分享发起、新报名/待定、预留及认领、候补接受、审批和成局；已发布活动增加容量或延长报名截止也被阻止。已有活动可查看、本人可退出及拒绝补位，举报仍能提交。发起页与活动详情页按服务端开关隐藏新增操作，保留退出；旧 offer 不再显示可接受按钮，外部 `WAITLIST_OFFER` 发送任务会记录为过时而不继续发送。补位和预留过期任务仍释放状态，但不会生成新 offer。

恢复时，为仍在招募且有候补的活动写入 `RESUME_WAITLIST` 持久任务，按原 FIFO 补位；即使任务尚未运行，新报名也先补齐旧队列，不能插队。旧恢复任务如遇再次关闭，不会补位。恢复前已经被抑制的外部发送不会自动重发。

先写失败用例，原 `/ops/emergency` 返回 404。随后 `test/emergency-gate.test.ts` 验证权限、私密原因隔离、关闭下读/退出/举报可用、旧 offer 不能接受但能拒绝、无重复补位、恢复任务和新报名的 FIFO、再次关闭后旧任务安全跳过。`test/operator-ui.test.ts` 验证运营页面显示状态并提交原因；`test/miniprogram.test.ts` 验证发起页关闭时不发送新建请求。正式运营值守覆盖和事故回滚仍需实际人员、目标环境及演练，未由本机测试替代。

全新本机 PostgreSQL 18.6 库 `irl_r1_test_20260925_emergency_v24` 完成迁移 1–24、两个连接池和 100 人最后席位竞争；关闭状态跨连接池可读，另一连接池新建草稿被拒绝，恢复后同一幂等键可创建，脚本输出 `emergencyGateCrossPool=true`。数据库实例随后停止。最终 `pnpm test` 249/249、`pnpm typecheck` 和 `git diff --check` 通过。

微信开发者工具测试号、本地 `DEV_AUTH=1` 和隔离合成库 `.data/wechat-emergency-20260925`：先由本地运营身份关闭开关。模拟器打开“发起活动”页后，页面数据回读 `safetyStatus=CLOSED`，显示[暂停新增提示](wechat-emergency-stop-2026-09-25.jpg)；运行时回读 `#saveDraftButton` 和 `#publishPreviewButton` 的 `disabled=true`。服务端 `/system/safety` 回读 `CLOSED`，未泄露关闭原因。本地 API 在验证后停止；这不代表真机、正式账号或事故值守演练通过。

在同一隔离库先构造一场邀请制合成活动，再关闭开关，模拟器[活动详情页](wechat-emergency-event-2026-09-25.jpg)回读 `safetyStatus=CLOSED`。运行时找不到 `#joinButton`，仍能找到 `#leaveButton`；截图显示关闭提示及“退出报名”。本地 API 随后停止。

仍未覆盖 T03 的六类未来能力显式关闭清单，以及 T29 所要求的真实值守时段、目标环境止损/恢复与回滚对账。
