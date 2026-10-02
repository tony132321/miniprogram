# 最终候选微信开发者工具 CLI 预览编译（2026-09-29）

当前小程序工程使用测试 AppID `wxbbcab69099026d3f`。在加入发现页未开放控件修复后，仓库 `miniprogram/` 与隔离副本逐文件 `diff -qr` 退出码 0。隔离副本的 `cli preview --port 21467 --qr-format base64` 返回 `✔ preview`、`1,950,096 Byte`，退出码 0；仓库主工程在同一端口关闭项目再重开后，重复预览也返回相同包体、`✔ preview`、退出码 0。

过程中的失败没有计为通过：第一次指定自定义二维码输出路径报“路径无效”；发现页实点后一次主工程预览卡在上传，随后报 `pages/index/index.js, file not found`，尽管该本地文件存在且同源码副本预览成功。关闭并重开主工程后错误未复现。本次最终结果以明确的 `✔ preview` 和相同包体为准。

本轮发现页的实际模拟器点击与截图见[入口状态记录](discover-r1-inactive-controls-2026-09-29.md)；既有其余页面交互见[Stitch R1 端到端记录](stitch-r1-devtools-e2e-2026-09-29.md)、[扩展页面记录](stitch-r1-content-checkin-expense-devtools-2026-09-29.md)及[分享按钮记录](r1-share-click-devtools-2026-09-29.md)。computer use 本轮调用超时，未取得新的原生分享面板或真机证据；CLI 预览和本地模拟器均不能代替正式环境验收。
