# R1 分享按钮与归因落地：开发者工具隔离回归（2026-09-29）

对应 v3.1 开发包 `AC-RQ05`、`AC-UI-PG01`。本记录只覆盖测试 AppID 与本机合成环境中的页面按钮、回调路径和服务端回读；不把分享意图或模拟打开计作微信消息投递、送达或真人阅读。

## 隔离环境

- 微信开发者工具 `36.6.0`，测试 AppID `wxbbcab69099026d3f`；`cli auto` 端口 `9451`。小程序副本 `/private/tmp/irl-r1-gap-20260929/miniprogram` 与当前主仓库执行 `diff -qr --exclude=config.js` 无差异，副本 `config.js` 仅将本地 API 指向 `127.0.0.1:3031`。
- 服务端以 `DEV_AUTH=1`、`DATA_PATH=/private/tmp/irl-r1-gap-20260929/db`、`OPERATIONS_USERS=gap_ops` 启动。两次新合成邀请活动均经业务 API 建草稿、发布、运营审核批准；没有直接修改数据库。最终回归活动 ID 为 `bd00bc30-daba-46b7-b9c0-3bc5fcb05cfd`。分享口令与来源 token 只留在隔离目录 fixture，没有写入本证据。

## 实际操作与回读

1. 合成主办 `gap_host_20260929` 从活动页进入“主办工作台”，在模拟器实际点击“准备分享卡并记录来源”。页面生成来源并显示“主动分享邀请卡”。主办 `GET /events/{id}/share-metrics` 在点击前为 `shareIntents=0, attributedOpens=0`，点击后为 `shareIntents=1, attributedOpens=0`。
2. 自动化对渲染出的 `open-type="share"` 按钮实际调用 `tap()`，调用正常返回。随后**另行直接调用**页面 `onShareAppMessage` 方法读取卡片路径，确认其含不透明邀请口令与来源，不含主办开发身份。按钮点击后指标仍为 `shareIntents=1, attributedOpens=0`，未把点击误记为送达或打开。点击后的自动化截图仍是活动工作台，未捕获原生分享面板；因此本轮不能证明微信系统已实际弹出分享面板或发出消息。
3. 自动化切换到第二合成身份 `gap_outsider_20260929`，用上述回调返回的路径执行 `app.reLaunch`，相当于**模拟**带来源的新打开。活动页 `loadState=READY`、活动 ID 匹配，主办指标回读为 `shareIntents=1, attributedOpens=1, unknownSourceOpens=0`。这不是两台微信设备间的真实转发。
4. 主办重新进入活动页，在模拟器实际点击“撤销旧邀请并生成新邀请”。页面的新口令不同且旧来源已清空；第二身份请求旧 `/i/{token}` 返回 HTTP `404`，再用旧卡片路径进入页面为 `loadState=ERROR`，画面显示“邀请已失效”，并提供“重新加载活动”“回到我的活动”按钮。

两次独立新活动的同一脚本均退出码 `0`。最终活动的自动化输出为：`PREPARED 0→1/0`、`SHARE_BUTTON_TAP returned`、`CARD_CALLBACK pathHasOpaqueToken=true, pathHasSource=true, pathHasUserId=false`、`ATTRIBUTED_OPEN 1/1/0`、`ROTATED oldTokenHttpStatus=404, oldCardLoadState=ERROR`。四张目视核对过的合成截图已归档：[准备后的分享按钮](screenshots/r1-share-2026-09-29/share-prepared-visible.png)、[点击后的工作台画面](screenshots/r1-share-2026-09-29/share-after-native-button-tap.png)、[第二身份模拟打开](screenshots/r1-share-2026-09-29/share-open-outsider-visible.png)、[旧口令失效](screenshots/r1-share-2026-09-29/share-old-token-error-visible.png)。

## 命令与边界

- `cli auto --project /private/tmp/irl-r1-gap-20260929 --auto-port 9451 --trust-project`：退出码 `0`。
- `node /private/tmp/irl-r1-gap-20260929/seed.cjs`：两次均退出码 `0`；`node /private/tmp/irl-r1-gap-20260929/share-click-e2e.cjs`：两次均退出码 `0`。
- `cli close --project /private/tmp/irl-r1-gap-20260929`：退出码 `0`；本轮 API 收到 `SIGINT` 后退出码 `0`。结束后端口 `3031` 和 `9451` 均无监听。

`AC-RQ05` 的服务端归因、旧口令撤销和当前 UI 按钮路径获得本机模拟器证据；系统分享面板、真人接收、正式微信身份和真机转发仍无证据。当前脚本显式调用 `onShareAppMessage` 并模拟第二身份打开，不可将它描述成原生分享链路的完整端到端验收。
