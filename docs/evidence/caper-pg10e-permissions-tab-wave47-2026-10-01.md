# PG10-E 权限说明页签定向证据（2026-10-01）

## 参考与修改

- 用户 ZIP `stitch_design_system_generator (2).zip` 的 `stitch_design_system_generator/pg10_e/screen.png` 与 `code.html` 在正文前使用横向滚动的四个胶囊页签，最后一项为“权限使用说明”。原小程序只有挤在一行的三项；旧版顶部截图见 [调整前法律页](images/caper-legal-top-live-2026-09-30.png)。
- `miniprogram/subpackages/profile/legal/legal.wxml/.wxss` 将现有三项改为可横滑布局，增加第 4 个“权限使用说明”按钮。按钮定位到同页新增的“当前设备能力使用”卡片；`legal.js` 在可获得节点位置时扣除状态栏及固定顶部栏高度，避免标题被遮住，旧版查询能力不可用时按现有工程模式回退到选择器滚动。
- 新卡片只归纳当前源码实际调用：主动点击邀请码／签到码扫码入口才调起微信扫码；本人报名确认后主动点击“加日历”才请求写入活动时间和地点，后续活动变更不自动同步；浏览城市在页面手动选择，目前不调用设备定位。内容明确是工程说明，正式权限清单待审核发布。
- 现有“当前服务说明”、社区公约真实路由、未发布的第三方清单与 PDF 关闭态保留。没有照搬参考稿未经确认的 V4.2、认证、备案、正式生效日或协议确认状态。

## 定向验证

| 检查 | 结果 |
| --- | --- |
| 测试先行 | 新增 `test/miniprogram-pg10e-permissions-tab.test.ts` 后首次运行按预期失败：缺横向页签、权限入口和目标卡片。另一次新用例先红，指出滚动到元素顶端会让固定顶部栏遮挡目标标题。 |
| 聚焦回归 | `node --import tsx --test --test-concurrency=1 test/miniprogram-pg10e-permissions-tab.test.ts test/miniprogram-caper-profile-info-routes.test.ts`：**9/9 通过**。覆盖公开说明边界、真实第 4 项入口、扫码／日历／城市文案、顶部栏避让、相邻个人信息路由。 |
| 静态检查 | `node node_modules/typescript/bin/tsc --noEmit`、`node --check miniprogram/subpackages/profile/legal/legal.js`、`git diff --check` 均退出 0。 |

本轮未运行全量测试。后续用隔离微信开发者工具 CLI `preview` 成功后，实际打开该页并实点第四个“权限使用说明”页签：页面滚动值从 0 到 504，目标卡标题和扫码／日历／城市三项说明完整可见，目标顶边在视口约 455 px，自动化异常 **0**。[页签改后截图](images/caper-pg10e-permissions-before-wave47-2026-10-01.png)；[定位后的说明卡截图](images/caper-pg10e-permissions-after-wave47-2026-10-01.png)。脚本 `/private/tmp/project-irl-automator/legal-permissions-wave47-smoke.cjs` 在本机隔离目录。真机字号、不同屏幕宽度、正式协议审批仍未验；权限描述针对当前工程调用路径，后续新增设备能力时需同步更新。
