# PG06 协办工作台开发者工具回归（2026-09-29）

本记录只覆盖 Stitch R1 活动页中未报名协办的邀请入口、报名审批区、固定底栏布局和实际审批。使用独立源码副本 `/private/tmp/irl-pg06-5DSLjM`、独立 PGlite 目录 `/private/tmp/irl-pg06-5DSLjM/db`、本地 API `127.0.0.1:3017` 和微信开发者工具自动化端口 `9437`；未共用另一组端口 `3001`、`9422` 或其数据库。副本的 `miniprogram/config.js` 仅把开发 API 指向 `3017`，主仓库配置未修改。测试 AppID 为 `wxbbcab69099026d3f`，身份均为 `DEV_AUTH=1` 的合成身份。

合成邀请活动 `2944b89d-5726-407c-ba6f-692e226ed02b` 由 `pg06_host` 通过业务 API 创建和发布，再由合成运营身份 `pg06_ops` 调用运营审核接口批准，最后通过活动协办授权接口授予未报名的 `pg06_cohost` 单项 `APPROVE_REGISTRATION` 权限。`/me/events` 回读主办 `isHost=true`、协办 `isCohost=true`；未通过直接改库授权或跳过审核。邀请口令只保存在隔离副本的临时 fixture 中，没有写入本仓库证据。

## 修复前

隔离副本 CLI `preview` 退出码 0，包体 **1,948,132 Byte**。`pg06-automator.cjs` 实际在首页输入邀请口令并点击“打开邀请”：主办进入活动页，点击“主办工作台”后 `activeSection=hostSection`，授权按钮可见，返回首页成功；未报名协办进入同一活动时 `isHost=false`、`canApproveRegistration=true`，能读取审批区且看不到主办独有授权按钮，返回首页成功。

旧版协办审批区没有顶部页签，也没有活动卡样式。截图中固定“本人报名或申请”栏覆盖审批按钮下部：[修复前截图](screenshots/stitch-r1-2026-09-29/pg06-cohost-before.png)。这是视觉遮挡，**不是按钮不可点击的证据**：`cohost-approve.cjs` 在页面滚动到底部后实点“同意申请”，按钮元素偏移为 `left=0, top=636.96`；合成申请人 `pg06_applicant` 的 `/me/registrations` 随后从 `REQUESTED` 回读为 `CONFIRMED`，页面提示“已审核报名”。

## 修复后

只把主仓库当时的 `miniprogram/` 文件同步到隔离副本，保留副本的 `config.js`。更新后 CLI `preview` 退出码 0，包体 **1,859,699 Byte**。另以 `pg06_applicant2` 通过报名接口创建真实 `REQUESTED` 合成申请。`cohost-redesign-e2e.cjs` 再次从首页实际输入邀请口令：点击顶部“协办审批”后 `activeSection=cohostApprovalSection`，该分区有 `event-section cohost-section` 卡片样式。

[修复后截图](screenshots/stitch-r1-2026-09-29/pg06-cohost-after.png)显示“同意申请”完整处于固定报名栏上方；按钮偏移 `left=35, top=499.46`，页面滚动值 `1592`。自动化实际点击该按钮后，`pg06_applicant2` 的 `/me/registrations` 回读为 `CONFIRMED`；返回首页成功。两张截图的 SHA-256 依次为 `577530dbb4dc123389b9cc140553835f44411bce04cee925e12a90d6fdb58fd0` 和 `c23e31393c8fe7885111d93cacd1f765503260ad8a23b1c30d7076fe120916c4`。

隔离脚本与临时 fixture 位于 `/private/tmp/irl-pg06-5DSLjM/`，不是仓库交付代码。测试后 `3017` API 已停止，微信开发者工具 `cli close --project /private/tmp/irl-pg06-5DSLjM` 返回成功；工具全局 helper 的 `9437` 监听未强杀，以免影响其他项目。本证据仅证明本地测试号、合成账号、本地 API 的这些点击及服务端回读；不覆盖正式微信身份、合法 HTTPS 域名、真机、其他协办权限、真实活动或运营值守。

## 首页协办归类补验

随后发现未报名协办在 `/me/events` 中有 `isCohost=true`、`myRegistrationStatus=null`，旧首页将其默认归到“即将参加”。先加入含仅协办、已确认且协办、候补且协办三种状态的页面回归，确认旧行为失败；修复后仅协办进入独立“协办”页签，已报名协办仍按本人报名状态归类。`test/miniprogram.test.ts` **88/88**、类型检查和差异检查通过。更新隔离副本后 CLI `preview` 成功，包体 **1,950,309 Byte**。

`cohost-home-e2e.cjs` 用仍有效的合成协办身份实际打开首页：服务端和页面均为未报名，页面 `attending.length=0`、`cohosting.length=1`；点击“协办”后卡片显示“协办中”和“你是协办方”，点击卡片进入对应活动，回读 `canApproveRegistration=true`，再返回首页成功。[首页协办页签截图](screenshots/stitch-r1-2026-09-29/pg06-cohost-home.png)的 SHA-256 为 `2d26c5a77992719927162a71a5436748c751b4d2b23fd5a382dbd158a56f9fa3`。自动化脚本首次读取点击后的页面状态和返回路由时过早，补充等待页面状态切换后完整重跑退出码 0；该时序失败不代表产品点击失败。此次复测使用相同隔离数据库与 `3017`/`9437` 端口，不扩大正式环境和真机的证据范围。
