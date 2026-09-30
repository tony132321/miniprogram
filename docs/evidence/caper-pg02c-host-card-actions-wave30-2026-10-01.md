# PG02-C 主办卡操作定向复核（2026-10-01）

对照用户 ZIP 中 `pg02_c/screen.png` 与 `code.html`，将“我组织的”状态卡操作归到卡片底部按钮行。招募中主办卡保留“主办工作台”和分享入口，新增“发公告”直达当前活动主办工作台的真实公告输入区；已成局或进行中主办卡的次按钮改为“签到核销码”，进入已有主办验码模式。草稿和待审卡仍使用安全的“查看活动”入口。按钮不会直接群发，也不会生成永久签到码。

定向测试 `test/miniprogram-caper-home-state-views.test.ts` 与 `test/miniprogram-event-screen-navigation.test.ts` **30/30 通过**，覆盖不同活动状态、当前身份、错误活动 ID 和服务端权限重核。`tsc --noEmit`、相关 JS 语法检查、`git diff --check` 通过；未运行全量测试。

将完整 `miniprogram/` 同步到隔离开发者工具项目 `/private/tmp/caper-r1-e2e-20260930/miniprogram-project/miniprogram/`；除测试项目本地 `config.js` 与 `.DS_Store` 外，`diff -qr` 为 0。测试 AppID `wxbbcab69099026d3f`、本地合成 API `127.0.0.1:3037`；CLI `preview --port 21467` 退出 0，总包 **2,145,045 Byte**。自动化脚本 `/private/tmp/project-irl-automator/caper-wave30-pg02c-host-actions-20261001.cjs` 连接 `9495`，实际点击两张服务端合成活动卡的小程序按钮：

| 路径 | 模拟器及服务端事实 | 截图 |
| --- | --- | --- |
| 招募中主办卡 | 合成主办 `caper-r1-offer-host-20260930` 的活动 `97ed8055-27fb-484e-87a2-9986805fcae1`，次按钮“发公告”与分享按钮同时可见。 | [招募中卡片](images/caper-wave30-pg02c-recruiting-actions-2026-10-01.png) |
| 点击“发公告” | 进入同一 ID 的 `pages/event/event`，`activeSection=hostSection`、`entry=hostAnnouncement`；经当前活动与主办权限重核，公告区标题距视口顶部约 143px，输入框和“提交公告”均在当前画面可见。仅打开编辑区，未提交公告。 | [真实公告输入区](images/caper-wave30-pg02c-announcement-composer-2026-10-01.png) |
| 已成局主办卡 | 合成主办 `caper-r1-actor-20260930` 的活动 `02c295b8-10e0-4602-8d25-1dc0d801a5f1`，底部显示“主办工作台／签到核销码”，没有重复签到捷径。 | [已成局卡片](images/caper-wave30-pg02c-confirmed-actions-2026-10-01.png) |
| 点击“签到核销码” | 进入同一 ID 的 `checkinSection`、`entry=hostCheckin`，`checkInMode=host`。模拟器中的活动尚未到签到开放时段，因此显示时间窗说明，没有伪造当前动态码。 | [主办验码模式](images/caper-wave30-pg02c-host-checkin-2026-10-01.png) |

本次小程序 `exception` **0**。截图证明测试 AppID 模拟器中的对应按钮、授权路由与可见布局；不代表与 39 张设计稿逐像素一致，也不代替真机摄像头、正式 AppID、合法 HTTPS 域名或真人活动验收。
