# PG10-C Wave 59 实现与定向检查

状态：页面实现完成；等待根代理微信工具编译、同设备截图与实点复核，不宣称像素验收通过。

## 修改

- `miniprogram/subpackages/profile/moments/moments.{wxml,wxss,js}`：375px 页面宽度按 750rpx 换算，恢复侧距 32rpx（16px）、卡内距 24rpx（12px）、标题 34/44rpx（17/22px）、元信息及摘要说明 26/36rpx（13/18px）、筛选 26/32rpx 及 12/28rpx 内距、类别与头像 64rpx（32px）、摘要图标 80rpx（40px）、CTA 104rpx（52px）。头部 112rpx（56px），更多命中区 88rpx；保留动态原生胶囊避让。
- 本页 `assets/`：8 张原 HTML URL JPEG 保存原响应字节，总计 544960 bytes；`reference-sources.json` 记录完整 URL、字节数、SHA256 和 design-only 使用标签。没有生成替代照片。头像复用 itinerary 的白色 person CSS 轮廓；其余占位图标改为本地 SVG 轮廓。
- badminton 使用原扣杀/合影/计分板，picnic 使用原敬饮/野餐毯/朋友，boardgame 使用原博弈/朋友。匹配真实 API 行的 type 或标题；没有添加虚构活动。照片排列分别采用 4:5+两个正方形、三张 3:4、两张 4:3；用宽度百分比和 padding 比例适配屏宽，calc 仅加减以保持微信 WebView 兼容。
- 保留 `/me/events`、会话隔离、筛选、真实详情和发起目标；配图示意、相册/打包/点赞/评论/人脸关闭文案保留。摘要关闭说明按恢复字号自然换行，关闭徽标放摘要底部避免挤压标题。

## 检查结果

1. `node --check miniprogram/subpackages/profile/moments/moments.js`（使用 brief Node PATH）：exit 0。
2. `git diff --check -- miniprogram/subpackages/profile/moments`：exit 0。
3. `file miniprogram/subpackages/profile/moments/assets/*.jpg`：8 个均有效 JPEG，1 张 512×512、7 张 512×279；原字节未转码。
4. 受影响既有文件 `node --import tsx --test --test-concurrency=1 test/miniprogram-moments-session-isolation.test.ts test/pg10-remaining.test.ts test/miniprogram-caper-profile-visual.test.ts`：首轮 27 项，24 pass/3 fail。两个是测试硬编码旧羽毛球封面（visual:180、remaining:110）；第三项 exact class regex 因附加布局类失败，已将布局类移到卡祖先修复。
5. 修复后的定向命令增加 `--test-name-pattern='moments|activity records|activity card|filtering activity|show-all'`：11 项，10 pass/1 fail（remaining:110 旧封面断言）。会话延迟响应、token rotation、过滤清理、logout、待审/草稿详情、照片只能进真实详情及头部发起目标通过。根代理已被告知更新两处旧封面期望；本工作者没有越界改测试。

## 复核与风险

- 根代理应更新两处素材路径断言后复跑上述受影响既有文件。没有跑全量、共享模拟器、提交或 push。
- 根代理需检查微信编译是否支持本地 SVG image 和百分比 padding；同设备确认 32px 头像与 44px 更多命中区仍避让原生胶囊、长标题截断、摘要两行披露及 CTA 安全区。
- 新图片约 532KiB，须由根代理统一检查 profile 分包包体限制。
- 原照片仍仅为示意；不代表任何本人活动实际影像。非上述三类活动保留原有示意素材分支，未扩大照片能力。

## 根代理整合补验

后续修正、最终定向结果、CLI 包体及模拟器实点见 [Wave 59 整合证据](caper-wave59-focused-devtools-2026-10-01.md)。本报告的实现阶段结果保留，整合结果以该证据为准。
