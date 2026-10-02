# PG10-B 勋章墙卡片与分享入口定向证据（2026-10-01）

## 对照与变更

- 用户提供的 `stitch_design_system_generator (2).zip` 中 `stitch_design_system_generator/pg10_b_social_badges/screen.png` 是三列高卡片勋章墙，底部有渐变分享主按钮。此前小程序三列卡较矮，底部仅有“查看我的真实活动记录”；旧版开发者工具截图见 [调整前勋章页](images/caper-badges-wave8-2026-09-30.png)。
- `miniprogram/subpackages/profile/badges/badges.wxss` 增大三列卡高度、图标和标题比例；底部主按钮改为与参考稿相近的蓝紫渐变固定栏，并为设备安全区及滚动内容留空间。
- `badges.wxml` 将主按钮改为“分享勋章墙概念预览”，使用微信小程序原生 `open-type="share"`；`badges.js` 的 `onShareAppMessage` 只分享本概念页，标题明确“勋章尚未开放”。原有“查看我的真实活动记录”保留为次级入口，仍进入本人真实活动页。
- 参考 HTML 的分享按钮只显示“已生成专属成就海报”的提示，并未生成或验证海报。本实现不声称已授予 28 枚勋章、已佩戴、已有 XP／等级，也不声称生成海报或可直接发朋友圈。单枚勋章详情相应说明其分享尚未开放，只有本概念页可分享。

## 验证边界

| 检查 | 结果 |
| --- | --- |
| 测试先行 | 新增 `test/miniprogram-pg10b-badge-share-parity.test.ts` 后首次定向运行失败：页面无原生分享按钮、无 `onShareAppMessage`。 |
| 聚焦回归 | `node --import tsx --test --test-concurrency=1 test/miniprogram-pg10b-badge-share-parity.test.ts test/pg10-profile-edit-badges-parity.test.ts`：**3/3 通过**；覆盖分享按钮与说明、精确分享路径、活动记录导航、既有未开放边界。视觉尺寸仅按 CSS 和参考图人工核对，不用照搬实现的断言代替视觉验收。 |
| 静态检查 | `node node_modules/typescript/bin/tsc --noEmit`、`node --check miniprogram/subpackages/profile/badges/badges.js`、`git diff --check` 均退出 0。 |

本轮未运行全量测试。后续在隔离微信开发者工具 CLI `preview` 成功后，用合成账号打开勋章页并[保存改后截图](images/caper-pg10b-wave46-2026-10-01.png)：三列大卡和固定底部分享栏可见，页面自动化异常 **0**。同页回读 `onShareAppMessage` 返回带“勋章尚未开放”的 CAPER 标题和本概念页路径。原生分享面板的真实发送、朋友圈以及真机投递未验，截图也不代表同尺寸逐像素一致。
