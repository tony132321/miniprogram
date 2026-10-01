# PG10-F 本机存储刷新反馈定向证据（2026-10-01）

## 参考与修改

- 用户 ZIP `stitch_design_system_generator (2).zip` 的 `stitch_design_system_generator/pg10_f/screen.png` 在底部显示“最近清理时间”和一键清理按钮。当前工程没有经过验证的可清理缓存分类，本机存储还可能包含登录会话和草稿，因此原页使用真实 `wx.getStorageInfoSync` 读数及“重新读取设备存储”按钮。旧版截图见 [调整前本地存储页](images/caper-cache-live-2026-09-30.png)。
- 原按钮在连续读数相同时没有可见反馈。本次仅在原生读数成功后更新“本机最近读取时间”，使用设备当前时间并置于参考稿底部状态行位置；读取失败则清除旧成功时间、显示失败提示，避免暗示刚刚成功读取。
- 不调用 `clearStorageSync`、`removeStorageSync` 或任何删除接口，不声称释放了空间，也不虚构海报、聊天、音频缓存的容量或“最近清理时间”。现有账号数据请求入口继续指向真实本人请求表单。

## 定向验证

| 检查 | 结果 |
| --- | --- |
| 测试先行 | 新增 `test/miniprogram-pg10f-storage-read-status.test.ts` 首次运行按预期失败：WXML 没有“本机最近读取时间”状态行。 |
| 聚焦测试 | `node --import tsx --test --test-concurrency=1 test/miniprogram-pg10f-storage-read-status.test.ts test/pg10-legal-cache.test.ts`：**6/6 通过**。固定本机时钟验证成功读取时间更新、失败清除、零存储写入／清除，并覆盖既有统计值和隐私请求路由。 |
| 静态检查 | `node --check miniprogram/subpackages/profile/cache/cache.js`、`git diff --check`、`node node_modules/typescript/bin/tsc --noEmit` 最终均退出 0。并行改动期间，全项目类型检查曾因另一份新增测试中 `page` 可能为 `undefined` 而短暂失败；最终重跑已通过。 |
| 隔离预览 | 复制旧隔离小程序后，仅同步本批 `cache.js`、`cache.wxml`、`cache.wxss`；微信开发者工具 CLI `auto` 使用 IDE 端口 `21467`、自动化端口 `9548` 成功，CLI `preview` 退出 0，包体 `2,231,046` 字节。 |
| 模拟器实点 | 自动化实际打开 `subpackages/profile/cache/cache`，初始 `storageState=READY`；点击“重新读取设备存储”后仍为 `READY`，本机最近读取时间从 `2026-10-01 12:12:58` 更新为 `2026-10-01 12:13:02`，页面状态行文字与数据一致；该隔离环境读数为已用 `0.00 MB`、上限 `10.00 MB`、占比 `0%`。本次路线捕获的 `exception` 数为 **0**。 |

改后模拟器截图：[点击刷新后的本地存储页](images/caper-pg10f-refresh-wave48-2026-10-01.png)。截图只含本机读数与状态行，不含账号或活动个人资料。本轮未运行全量测试。定向测试里的时间和存储读数由桩提供；上述实点来自微信开发者工具模拟器，真实手机的存储读数、排版和时间仍需真机复核。
