# PG10-C 活动记录视觉与详情实点（2026-09-30）

对照用户提供的 `stitch_design_system_generator (2).zip` 中 `pg10_c/screen.png`，在既有 `subpackages/profile/moments/moments` 上调整筛选条、渐变摘要、活动卡、三图拼贴、相册关闭态及固定底部按钮。原图顶部标题确为 `Edit Profile`，本轮按原图保留。卡片标题、日期、场地、状态与数量来自当前身份的 `GET /me/events`；摄影素材是已有 Stitch 插图，画面标注“示意配图／活动相册未开放”。没有套用原图中的人物、点赞、照片数或回忆率作为真实数据。

隔离微信开发者工具使用测试 AppID、本机 API 与合成身份 `caper-r1-actor-20260930`。页面进入 `READY` 后显示 **3 场**该身份的活动记录；点击首卡三图拼贴，进入 `pages/event/event`，详情 `READY` 且活动 ID 与卡片一致：`02c295b8-10e0-4602-8d25-1dc0d801a5f1`。页面异常 **0**，结束时恢复 `pages/index/index` 的 `READY`。自动化脚本：`/private/tmp/project-irl-automator/caper-moments-pg10c-wave14-20260930.cjs`。

[当前活动记录截图](images/caper-moments-pg10c-wave14-2026-09-30.png)。截图仅是隔离模拟器中的合成账号状态；与设计原图并非同尺寸逐像素验收，且只实点了拼贴至对应活动详情。顶部菜单、个人入口和筛选另有既往局部证据及定向用例。

`src/feature-flags.ts` 的 `photo_album=false`：照片上传、同场相册、打包、点赞、评论及人脸找图均未开通。页面的“打包待开放”“照片上传待开放”“AI 人脸智能找图·待开放”是说明，不触发上述服务；底部主按钮进入已有真实活动首页。涉及肖像的拍摄分享提示可进入社区公约，不展示或声称真人活动照片。

聚焦检查 `test/pg10-remaining.test.ts` 与 `test/miniprogram-caper-profile-visual.test.ts` **21/21** 通过，`git diff --check` 通过；未运行全量测试。这些结果不覆盖正式 AppID、HTTPS 合法域名、真机、真人活动或订阅消息验收。
