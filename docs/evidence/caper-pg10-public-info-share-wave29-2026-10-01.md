# PG10-H 公开说明页分享入口（Wave 29，2026-10-01）

对照设计包 `stitch_design_system_generator (2).zip` 的 `pg10_h_1`、`pg10_h_2`、`pg10_h_3`：三个顶部标题栏均有独立分享图标。当前工程分别对应功能与版本说明、社区引导、开源许可与致谢。三页加了避开微信原生胶囊的 `open-type="share"` 顶栏按钮；分享 payload 仅含本页的公开路径和反映当前内容的标题，不带用户、活动 ID、邀请码或查询参数。现有 More、返回和个人页入口保留。

- 聚焦测试先观察到 `page.onShareAppMessage is not a function` 的预期失败；实现后 `test/miniprogram-caper-profile-info-routes.test.ts` 与 `test/pg10-remaining.test.ts` **12/12** 通过，`tsc --noEmit` 与 `git diff --check` 均通过。没有运行全量套件。
- 将完整 `miniprogram/` 同步至 `/private/tmp/caper-r1-e2e-20260930/miniprogram-project`，保留隔离项目的 `config.js`。`diff -qr --exclude=config.js --exclude=.DS_Store` 退出码为 0；配置 SHA-256 仍为 `1f2737bf6580082d82ccf378071d1436b4c2d17f536a3fc539fe88a1c1ae0455`。测试 AppID 是 `wxbbcab69099026d3f`，本机合成 API 为 `http://127.0.0.1:3037`。
- 微信开发者工具 CLI `preview --project /private/tmp/caper-r1-e2e-20260930/miniprogram-project --port 21467` 退出码 0，总包 **2,144,023 Byte**。`miniprogram-automator` 在同一模拟器端口 `9495` 依次打开三个公开路径，读到各自页面标题、`open-type="share"` 属性，实际点击顶栏分享按钮后仍停留在对应页面，小程序异常 **0**。脚本：`/private/tmp/project-irl-wave29-share/pg10-public-share.cjs`。
- 顶栏实拍：[功能与版本说明](images/caper-wave29-pg10-release-notes-share-2026-10-01.png)、[社区引导](images/caper-wave29-pg10-guidelines-share-2026-10-01.png)、[开源许可](images/caper-wave29-pg10-open-source-share-2026-10-01.png)，均为 580 × 1260 px 的开发者工具模拟器截图；分享图标位于标题与 More 之间，未覆盖原生胶囊。

自动化只能确认按钮属性、点击可返回及目标页在模拟器可直接打开，不能证明微信原生分享选择器在真机出现、分享成功送达或接收方真机回开。正式 AppID、合法域名与真机账号仍待外部资源。
