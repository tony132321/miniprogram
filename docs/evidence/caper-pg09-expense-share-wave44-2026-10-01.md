# PG09 费用页顶栏分享：当前 AA 账本摘要（2026-10-01）

## 参考与行为

对照用户提供的 `stitch_design_system_generator (2).zip` 中 `pg09/screen.png`：费用页顶栏有分享图标。现有活动页的同一图标原先只执行通用活动分享，主办打开邀请卡，成员复制活动详情；本轮在 `expenseSection` 将它接到当前 AA 账本摘要，其他分区仍使用原行为。图标的无障碍说明随分区改为“复制当前费用记录摘要”。

`GET /events/:id/expenses` 的服务端授权边界是：主办可读本场全部份额；`CONFIRMED` 或 `RECONFIRM_REQUIRED` 成员仅可读本人份额；其他账号返回 403。页面每次点击先运行现有 `refresh()`，重新读取本场活动、本人报名状态和授权账本，再读取一次当前活动详情核对版本、状态及名称。仅唯一的 `current`、`RECORD_ONLY` 且金额和版本有效的账本可复制。主办摘要仅含活动名、当前账本版本、总额、份额人数和“仅作记录”；成员摘要仅含活动名、本人份额和本人／主办双方的处理记录，**不复制账本总额、他人 ID、昵称或逐人金额**。两种摘要都写明“本摘要仅为 AA 费用记录，不代表付款或结清凭证”。金额由现有整数分格式化函数生成。

在复制前及剪贴板回调时再次核对账号、活动、页面分区、刷新代次和当前账本标识／版本／总额。无账本、历史版本、权限变化、账号切换和多个当前版本都不复制；迟到的剪贴板回调不在旧身份或旧账本上显示成功消息。服务端读取与系统剪贴板调用之间无法形成原子事务，因此用户仍应以活动页最新账本为准。

## 本地验证

- 新增 `test/miniprogram-pg09-expense-share.test.ts`：实现前 **8/8 按预期失败**，主因是现有顶栏仍走活动分享；活动版本变动用例也曾单独观察到 RED。最终 **11/11 通过**。覆盖主办脱敏汇总、成员本人份额、报名成功页原分享路径、当前账本修订、活动版本突变、旧版及空态、无权访客、重复当前版本、非法金额／版本、请求期间切换账号、迟到剪贴板回调。
- 邻接活动页定向测试 **37/37 通过**：`test/miniprogram-pg09-expense-share.test.ts`、`test/miniprogram-event-expense-interactions.test.ts`、`test/miniprogram-event-controls.test.ts`、`test/miniprogram-event-session-isolation.test.ts`、`test/event-caper-navigation.test.ts`。其中新测试 **11/11**。
- TypeScript `tsc --noEmit`、`node --check miniprogram/pages/event/event.js` 和 `git diff --check` 在实现后均退出码 0。

## 微信开发者工具定向实点

- 完整 `miniprogram/` 已同步至隔离项目 `/private/tmp/caper-r1-e2e-20260930/miniprogram-project`，保留该项目本地 API 配置；排除 `config.js`／`.DS_Store` 后目录比较无差异。测试 AppID 为 `wxbbcab69099026d3f`，本地 API 为 `127.0.0.1:3037`。微信开发者工具 CLI `preview --project ... --port 21467` 退出码 0，总包 **2,208,271 Byte**。本机原生 Computer Use 窗口状态调用超时；下述触控来自 CLI／`miniprogram-automator`，不能算原生 Computer Use 验证。
- 使用已有的四人合成 AA 活动 `d9fe2434-1260-4cae-b921-27238e7a7956`，真实 API 回读 `feeMode=AA`、主办身份 `caper-pg09-art-muoljo3y-host`、当前账本版本 1／总额 `10001` 分。自动化脚本 `/private/tmp/project-irl-automator/pg09-share-wave44-smoke.cjs` 经端口 `9495` 连接模拟器，分别以主办和已确认成员 `caper-pg09-art-muoljo3y-member-1` 打开同场 `expenseSection`，**实际点击**顶栏 `.event-nav-share`。
- 主办剪贴板含 `100.01`、`4 人` 与“非付款或结清凭证”说明，不含任何合成用户 ID 或逐人份额；成员只含本人 `25.00`、双方尚未记录状态及同一说明，不含总额、其他份额或用户 ID。两次页面消息均为“当前 AA 费用记录摘要已复制。”；小程序异常 **0**。脚本退出码 0，结束后恢复主办费用页供检查。[主办点击前](images/caper-pg09-share-host-before-wave44-2026-10-01.png)、[主办点击后](images/caper-pg09-share-host-after-wave44-2026-10-01.png)、[成员点击后](images/caper-pg09-share-member-after-wave44-2026-10-01.png)截图存档；点击后可见系统“内容已复制”提示。成员截图顶部还出现开发者工具读取剪贴板时的系统提示，并非应用弹窗。

本轮未运行全量测试。上述是测试 AppID、合成 API 与微信开发者工具模拟器证据，不是微信原生分享投递、真机、真实资金流或整屏逐像素验收。该功能不表示平台已付款、收款或结清。
