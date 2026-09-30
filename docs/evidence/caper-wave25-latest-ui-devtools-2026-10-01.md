# Wave 25 最新 UI：微信开发者工具定向复核

- 定版源码：本地 `99204aa952a228ee7bc22cfb6577498e27f05a1e`，Git 树 `bf2287d953b17531b9923ee73c1b7ff4012fce9b`。隔离项目 `/private/tmp/caper-r1-e2e-20260930/miniprogram-project` 使用测试 AppID `wxbbcab69099026d3f` 和本机合成 API `http://127.0.0.1:3037`。同步完整 `miniprogram/`，只保留隔离项目 `config.js`；`diff -qr --exclude=config.js` 退出码 0。隔离配置 SHA-256 为 `1f2737bf6580082d82ccf378071d1436b4c2d17f536a3fc539fe88a1c1ae0455`。
- 微信开发者工具 CLI `preview --project /private/tmp/caper-r1-e2e-20260930/miniprogram-project --port 21467` 退出码 0，总包 **2,139,136 Byte**；`miniprogram-automator` 经 `9495` 连接同一模拟器。设备配置为 iPhone 17 模拟器，页面窗口 402 × 874 px，安全区底边 840 px。
- 原生 Computer Use 的 `cua.getState()` 在并行检查中等待 30 秒后超时，没有取得原生窗口画面；以下可操作截图与点击结果来自开发者工具 CLI／automator，不把超时当作原生控制通过。

| 定向路径 | 实际结果 | 源码快照 |
| --- | --- | --- |
| PG10-C 活动记录 | 以合成账号读取 3 条本人活动，`loadState=READY`。摘要高 85 px；底部“发起新活动”按钮在 y=786.2–831.0 px，完全高于安全区底边 840 px。滚至末尾后说明文字仍完整可见，图片不再穿透状态栏。顶栏“更多”实点展开并关闭，底部按钮实点进入 `pages/create/create`，再回到活动记录页；页面异常 0。见[顶页](images/caper-wave25-pg10c-safe-area-2026-10-01.png)、[末尾](images/caper-wave25-pg10c-scroll-safe-area-2026-10-01.png)、[更多菜单](images/caper-wave25-pg10c-more-menu-2026-10-01.png)。 | 定版 `99204aa` |
| 发起页读取失败 → 回到我的活动 | 用不存在的合成活动 ID 触发编辑读取错误后，实点“回到我的活动”，进入 `subpackages/profile/moments/moments`，分类为 `all`、列表 `READY`。没有保存、发布活动。 | `fd7f75c`；定版未重跑该错误路径 |
| 活动页读取失败 → 回到我的活动 | 用同一不存在的合成活动 ID 触发活动读取错误后，实点“回到我的活动”，进入相同活动记录页，分类 `all`、列表 `READY`。 | `fd7f75c`；定版未重跑该错误路径 |
| PG10-D 隐私与安全 → 举报与求助 | 实点隐私页求助卡，进入 `pages/me/me`；`advancedOpen=true`，`#reportSection` 和[举报表单](images/caper-wave25-report-target-2026-10-01.png)实际可见。没有提交举报。 | `fd7f75c`；定版未重跑该跳转 |
| 发现分类 | 实点“附近”出现尚未开放提示，再实点“全部”将 `availabilityMessage` 清空；见[清空后页面](images/caper-wave25-discover-all-2026-10-01.png)。 | `fd7f75c`；定版未重跑该点击 |
| 个人页授权开关 | 定版个人页 `loadState=READY`，活动提醒与类似活动授权均为 `READY`，两个开关尺寸均约 41 × 23 px，无遮挡且无待提交状态；见[页面截图](images/caper-wave25-profile-consents-2026-10-01.png)。没有改变授权值。 | 定版 `99204aa` |

定版 PG10-C 复拍及顶栏／底部按钮实点脚本分别为 `/private/tmp/project-irl-wave25-devtools/pg10c-summary-candidate.cjs`、`pg10c-actions-candidate.cjs`，退出码均为 0，捕获页面异常均为 0。初轮其他路径脚本为同目录 `latest-ui-smoke.cjs`，修正模拟器点击后读取时序后退出码 0、页面异常 0。最后将模拟器停在定版 PG10-C 顶页供人工检查。

这是测试 AppID、合成账号和本机 API 的定向模拟器证据，未覆盖 39 页逐像素对照、全量自动测试、正式 AppID／HTTPS 域名、订阅消息、真机和真人活动验收。
