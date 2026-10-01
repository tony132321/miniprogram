# PG05-S 报名成功卡场地操作（2026-10-01）

用户 ZIP `stitch_design_system_generator/pg05_s/screen.png` 的场地地址行有“导航”按钮；对应 `code.html` 的 `copyAddress()` 实际复制地址。当前 R1 活动只有经服务端读取的城市与场馆名，没有坐标、地图服务或场馆路线。因此小程序在既有 `JOINED` 成功卡的场地行加入“复制地点”，复用详情页 `copyVenue()`；不把复制说成地图导航。

点击先以当前身份重新读取本场活动和本人报名。只有仍为同场 `CONFIRMED`、成功态仍为 `JOINED`、账号未变化时才复制新回读的 `city · venueName`。场馆名为空时不复制；身份切换、席位撤销、旧活动回读及 A→B→A 延迟响应不会操作旧数据。剪贴板异步成功或失败回调只在捕获身份和活动仍匹配时显示提示，包含匿名详情页在回调前切换账号的情况。未改变详情页对有权查看者原有的“复制地点”入口。

验证范围：

- `test/event-caper-navigation.test.ts` 新用例先对缺失按钮、旧账号异步成功提示呈红，再实现通过。最终该文件 **12/12**，相邻 `test/miniprogram-event-live-detail-layout.test.ts` **2/2**；真实 `refresh()` 测试覆盖当前场馆、撤销席位，延迟请求测试覆盖 A→B→A。`tsc --noEmit`、`git diff --check` 均退出 0；没有运行全量测试。
- 完整 `miniprogram/` 同步到独立 `/private/tmp/irl-wave35-venue-project`，仅把副本 `config.js` 的 API 地址改为 `127.0.0.1:3037`；`diff -qr --exclude=config.js` 退出 0。测试 AppID `wxbbcab69099026d3f`，CLI `preview --port 21467` 退出 0，包体 **2,288,860 Byte**。独立自动化端口 **9535**，未占用并行任务的端口。
- 脚本 `/private/tmp/project-irl-automator/caper-wave35-venue-20261001.cjs` 通过真实本地 API 打开已确认的合成成员 `caper-r1-actor-20260930` 的同场活动 `97ed8055-27fb-484e-87a2-9986805fcae1`；页面回读 `CONFIRMED` 且非主办。为了检查成功卡按钮的视觉与动作，脚本在已确认活动页通过自动化 `setData` 显示 `JOINED`，然后实际点击小程序“复制地点”。再次回读仍为该活动、该成员 `CONFIRMED`、`JOINED`；`wx.getClipboardData` 为 **`深圳 · 隔离环境合成测试球馆`**，等于当前服务端活动字段，脚本退出 0，捕获小程序 `exception` **0**。[成功卡按钮截图](images/caper-wave35-pg05s-venue-action-2026-10-01.png)。

这次实点证明已确认合成成员的成功卡按钮和剪贴板动作，不证明本轮重新走完报名提交，也不证明真机地图导航、正式 AppID、HTTPS 域名或原生分享。成功态由自动化设置用于页面核查；真实报名成功后的状态条件另由现有报名测试约束。
