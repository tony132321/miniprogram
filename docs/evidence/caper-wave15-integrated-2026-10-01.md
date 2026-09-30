# CAPER Wave 15 合并后的定向验证（2026-10-01）

本轮汇合首页/发起、活动、个人、消息、城市/行程、邀请卡和发现入口的独立改动后，仅执行必要的集成检查，按用户要求未运行全量测试。

| 检查 | 结果 |
| --- | --- |
| `pnpm typecheck` | 退出码 0 |
| `pnpm exec tsx scripts/scan-credentials.ts` | 退出码 0；暂存后复扫 700 个跟踪文本文件、1 个 ZIP，372 个二进制文件跳过 |
| `git diff --check` | 退出码 0 |
| 微信开发者工具 CLI `preview --project /Users/tsb/Documents/小程序 --port 21467` | 退出码 0；测试 AppID `wxbbcab69099026d3f`，总包 2,194,603 Byte |

随后将当前 `miniprogram/` 同步到隔离副本，副本仅把本地 API 指向 `127.0.0.1:3037`。微信开发者工具 CLI `auto` 连接端口 9494 后，使用合成身份重新打开 `pages/index/index`，页面 `READY`、`/me/events` 本人活动 3 条、运行异常 0，并将首页留在开发者工具供视觉检查。[合并候选首页截图](images/caper-wave15-integrated-home-2026-10-01.png)。聚焦脚本位于 `/private/tmp/project-irl-automator/caper-wave15-integrated-home-20261001.cjs`，退出码 0。

这张图及各分项证据只证明所列状态/按钮。最新提交未运行全量 CI，39 张参考设计的同尺寸逐页像素对照、正式 AppID/HTTPS、真机、订阅消息及真实运营试点仍未完成。
