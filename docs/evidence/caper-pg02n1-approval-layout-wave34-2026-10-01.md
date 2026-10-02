# PG02-N1 通知中心审批卡主次按钮（2026-10-01）

对照用户交付的 `stitch_design_system_generator (2).zip` 中 `pg02_n_1/screen.png` 与 `code.html`：待审批申请卡的蓝色主操作「一键通过」位于左侧并占据主要宽度，灰色「查看详情」位于右侧。此前小程序两按钮反向且均为右下角小按钮。现在仅调整 `pages/messages/messages` 的 CENTER 视图审批卡 WXML 顺序和 WXSS 布局；现有 `approveRequest`、`viewApproval` 绑定及服务端资格判断不变。`canApprove=false` 时仍显示「名额已满，暂不可通过」和可用的「查看详情」，不显示审批按钮。

验证使用独立小程序副本 `/private/tmp/project-irl-wave34-pg02n1`，完整 `miniprogram/` 与仓库比较时仅隔离 `config.js` 不同（`diff -qr` 退出 0）。该配置指向本地合成 API `127.0.0.1:3037`，微信开发者工具 CLI `auto` 使用测试 AppID `wxbbcab69099026d3f`、自动化端口 `9508`；没有使用正式账号或真机。服务端当前待审报名 `0cc0e443-0fc7-42f3-84e8-4b668ac91ee1` 的 `canApprove=true`，模拟器实际进入通知中心并渲染同一条申请：

- 蓝色主按钮位于左侧，位置与宽高为 `left=25, width=283, height=35` px；灰色详情按钮位于右侧，`left=313, width=64, height=35` px。[当前截图](images/caper-wave34-pg02n1-approval-layout-2026-10-01.png)。
- 实际点击「查看详情」进入 `pages/event/event` 的同活动 `f9d82605-c618-4e3f-ae1c-e23f2730bb95` 主办分区；捕获小程序异常 **0**。未点击「一键通过」；随后 `/me/approval-requests` 回读仍有这 1 条 `canApprove=true` 的待审申请。
- 聚焦 `test/miniprogram-messages.test.ts` **29/29** 通过，覆盖审批资格、详情目标和账号隔离；`tsc --noEmit` 与本次代码 `git diff --check` 均退出 **0**。没有运行全量测试。

这份证据仅证明审批卡动作布局和此次详情跳转；不等于 PG02-N1 全屏逐像素验收、真实微信通知送达或正式环境审批验收。
