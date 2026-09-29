# 发现页 R1.1 控件状态回归（2026-09-29）

当前 R1 仅允许通过邀请参与活动，公开找局属于尚未开放的 R1.1。此前发现页仍显示可输入的“搜索活动或地点”和可点击分类，但它们只修改页面本地数据，页面始终显示“公开找局暂未开放”。这使用户误以为搜索和筛选已可用。

本轮将搜索栏与分类保留为低强调的静态展示，并在页面直接说明“暂不可搜索”“分类暂不可筛选”；移除相应输入和点击处理。邀请口令打开活动、发起活动、城市偏好入口保留。未启用公开找局接口或改变 R1.1 闸门。

- 回归测试 `R1 discovery has no active public-search controls while invitation and creation remain usable` 先失败（旧页面仍有可输入搜索），修复后 **1/1 通过**。测试同时核对不可用说明、无搜索／分类操作绑定，以及邀请和发起路由仍可触发。
- `pnpm typecheck`、`git diff --check` 均退出码 **0**。
- 将仓库 `miniprogram` 原样复制至 `/private/tmp/irl-discover-smoke-20260929`，`diff -qr` 退出码 **0**。首次 CLI `auto --project /private/tmp/irl-discover-smoke-20260929 --auto-port 9472 --trust-project` 退出码 **255**，报现有 IDE 端口 `21467` 连接超时；显式指定 `--port 21467 --auto-port 9472` 后退出码 **0**，没有关闭原有 IDE。
- `miniprogram-automator` 在测试 AppID `wxbbcab69099026d3f` 的开发者工具模拟器实际打开发现页，读到“公开找局暂未开放”“暂不可搜索”“分类暂不可筛选”；六个分类以静态元素显示，搜索输入和分类按钮数量均为 0。实际输入合成无效邀请口令并点击“打开”后，页面路由进入 `pages/event/event`；返回发现页点击“发起自己的活动”后进入 `pages/create/create`。自动化脚本退出码 **0**，捕获小程序 exception **0**。[发现页截图](discover-r1-inactive-2026-09-29.png)保存本轮可见状态。无效邀请口令只证明入口路由，不证明令牌有效或后续报名成功。

本记录只覆盖发现页当前 R1 的入口诚实性和上述两条路由，不代表 R1.1 公开找局、正式微信、真实邀请投递或真机验收。
