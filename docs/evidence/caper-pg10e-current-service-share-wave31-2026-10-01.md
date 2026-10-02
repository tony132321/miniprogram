# PG10-E 当前服务说明分享入口（Wave 31，2026-10-01）

设计包 `stitch_design_system_generator (2).zip` 的 `pg10_e` 在阅读控制行中将 `ios_share` 放在字号按钮旁。现有页面是当前服务与隐私说明，不是已批准的正式协议，因此同排圆形按钮使用小程序原生 `open-type="share"`，分享标题为“Project IRL · 当前服务与隐私说明”，路径只指向公开的 `/subpackages/profile/legal/legal`。载荷不含账号、活动、邀请码或查询参数；页面继续显示“正式协议待核定”。

- 先增加聚焦测试，观察到 `page.onShareAppMessage is not a function` 的预期失败。实现后 `test/miniprogram-caper-profile-info-routes.test.ts` **7/7**、`tsc --noEmit`、`git diff --check` 通过；未运行全量测试。
- 将三个 legal 页面文件同步到隔离开发者工具项目后，完整 `miniprogram/` 与隔离项目排除本机 `config.js`、`.DS_Store` 的 `diff -qr` 退出码为 0。本机配置 SHA-256 仍为 `1f2737bf6580082d82ccf378071d1436b4c2d17f536a3fc539fe88a1c1ae0455`；测试 AppID 为 `wxbbcab69099026d3f`。
- 微信开发者工具 CLI `preview --project /private/tmp/caper-r1-e2e-20260930/miniprogram-project --port 21467` 退出码 0，总包 **2,147,744 Byte**。模拟器端口 `9495` 通过 `/private/tmp/project-irl-wave31-legal-share.cjs` 打开 PG10-E，读到标题和 `open-type="share"`，实际点击后仍在该页，小程序异常 **0**。
- 截图：[PG10-E 当前服务说明分享入口](images/caper-wave31-pg10-legal-share-2026-10-01.png)，580 × 1260 px。分享图标与 Aa 字号按钮同排，均为浅灰色圆形控件；顶栏保留返回、More 与个人入口，未覆盖微信原生胶囊。

模拟器只能确认入口存在、可点击、当前页面稳定；原生分享选择器、成功送达及接收方回开仍需真机与正式配置。正式协议、第三方清单和 PDF 仍未发布。
