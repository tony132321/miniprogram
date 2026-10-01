# 小程序主包压缩实测（Wave 52，2026-10-01）

PG04-S 加入参考照片后，隔离微信开发者工具在 `setting.minified=false` 的预览输出为总包 **2,305,453 Byte**、主包 **2,055,391 Byte**，主包距 2 MiB 仅 **41,761 Byte**。本次只把 `project.config.json` 的 `setting.minified` 设为 `true`，复制到同一隔离项目，未改动该项目小程序源码，再运行 `/Applications/wechatwebdevtools.app/Contents/MacOS/cli preview --project /private/tmp/caper-r1-e2e-20260930/miniprogram-project --port 21467`，退出码 0。

| 同一小程序源码 | 总包 | 主包 | 主包距 2 MiB |
| --- | ---: | ---: | ---: |
| JS 未压缩 | 2,305,453 B | 2,055,391 B | 41,761 B |
| JS 压缩 | 1,972,948 B | 1,772,505 B | 324,647 B |

主包减少 **282,886 Byte**；页面源码、路由和图片没有因此改动。该数字是隔离项目的 CLI 产物，不是加入后续代码变更后的最终包体，也不证明真机运行或正式上传。最终代码同步后仍需重新预览并定向实点受影响页面。用户提供的 PG04-S 参考 HTML 引用远程照片，当前本地 JPEG 保留于项目；正式发布前须核实该素材使用权。
