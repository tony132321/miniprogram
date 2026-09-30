# PG10-C 活动记录摘要条复核（2026-10-01）

对照用户提供的 `stitch_design_system_generator (2).zip` 中 `pg10_c/screen.png`、`pg10_c/code.html` 和旧版隔离模拟器图 `images/caper-moments-pg10c-wave14-2026-09-30.png`。原稿摘要条有两行信息；旧小程序只有一行，缩短了摘要条，也使活动卡相对原稿上移。本轮把当前账号真实活动数与“相册照片、点赞与评论尚未开放”分为两行，并给摘要条设置 `160rpx` 最低高度。没有复制原稿的 12 个瞬间、128 张照片、356 次点赞或 98.6% 回忆率。

服务端 `src/events.ts` 目前只接受 `badminton` 类型，`GET /me/events` 摘要也不返回类型、照片、成员相册或互动数据。因此原稿第二张野餐三列拼贴、第三张桌游双列拼贴及人物照片，不能按真实类型对应生成；本轮保留已有按本人活动展示的三图示意拼贴，不按卡片序号伪造不同相册。原稿底部“投递新活动照片”和人脸找图在 R1 无可用照片能力，现有按钮继续通向真实发起功能，并标明照片上传关闭态。

定向验证：`test/miniprogram-caper-profile-visual.test.ts` 和 `test/miniprogram-moments-session-isolation.test.ts` 共 **17/17** 通过；`./node_modules/.bin/tsc --noEmit` 退出码 0；`git diff --check` 退出码 0。本轮没有运行全量测试。新版微信开发者工具同设备截图及固定按钮安全区复拍仍由独立模拟器任务进行，尚不能据此宣称同尺寸逐像素一致或真机可用。
