# 微信开发者工具命令行预览（2026-09-28）

候选代码：本地 `8793471`，与 GitHub PR #1 远端 head `3f6ca31043bbf7706f77109c343edd5983b49601` 的 Git 树一致。

在已安装的微信开发者工具中运行：

```sh
/Applications/wechatwebdevtools.app/Contents/MacOS/cli preview --project /Users/tsb/Documents/小程序
```

工具输出 `Using AppID: wxbbcab69099026d3f` 与 `✔ preview`。首次附加二维码文件路径的尝试返回输出路径错误；不指定输出路径后成功。预览二维码及令牌未纳入仓库。

这证明当前项目可由开发者工具完成预览构建，不证明页面实际点击、后端请求成功、正式 AppID 权限、目标 HTTPS 域名或真机行为。当前电脑锁屏，界面交互尚未复测；解锁后需补做 RQ02 创建页明确时长、保存草稿再进入及发布前确认的点击验收。
