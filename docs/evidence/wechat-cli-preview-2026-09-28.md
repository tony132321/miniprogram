# 微信开发者工具命令行预览（2026-09-28）

候选代码：本地 `8793471`，与 GitHub PR #1 远端 head `3f6ca31043bbf7706f77109c343edd5983b49601` 的 Git 树一致。

在已安装的微信开发者工具中运行：

```sh
/Applications/wechatwebdevtools.app/Contents/MacOS/cli preview --project /Users/tsb/Documents/小程序
```

工具输出 `Using AppID: wxbbcab69099026d3f` 与 `✔ preview`。首次附加二维码文件路径的尝试返回输出路径错误；不指定输出路径后成功。预览二维码及令牌未纳入仓库。

随后使用微信开发者工具 `cli auto --project /Users/tsb/Documents/小程序 --auto-port 9420 --trust-project` 启动本地自动化服务，`miniprogram-automator@0.12.1` 连接模拟器。隔离数据目录中的本地 API 以 `DEV_AUTH=1` 运行；未使用正式微信账号或真实用户数据。自动化脚本进入 `pages/create/create`，实际向 textarea 输入“周六晚上八点打三小时羽毛球，AA 每人五十元”、点击“提取草稿字段”，页面数据读到 `templateDurationMinutes=180`、日期仍空、费用 50 元及“来自原话”标记。自动化调用该页 `setStartDate` 选择合成日期 2026-10-03，回读结束日期同日、时间 23:00；实际点击“保存草稿”，服务端返回草稿 ID。将该 ID 写入模拟器本地存储并重新进入创建页后，页面通过 HTTP 重新读取草稿，仍显示 180 分钟、23:00 和 50 元。两次独立执行均成功，第二次脚本退出码为 0。

这证明最新候选通过开发者工具预览构建，并在模拟器中完成一句话提取、保存和重新载入。日期由自动化调用页面处理函数触发，未验证原生 picker 的手指选择；未填写发布所需场地、人数等字段，故未把该草稿发布。当前电脑锁屏，无法补充可视界面点击或截图。正式 AppID、目标 HTTPS 域名及真机行为仍待验证。
