# PG10-C / F / G 原稿 UI 尺寸落地计划

**Goal:** 按用户 ZIP 原稿复刻三页布局、字号、间距、图标和配图，保持现有真实功能、身份保护与 R1 关闭说明。
**Spec:** `docs/evidence/caper-pg10c-f-g-visual-gap-audit-wave58-2026-10-01.md`；原 ZIP `stitch_design_system_generator (2).zip` 的 `pg10_c/f/g` HTML 与 PNG。
**Base:** `c352633`，现有专用工作分支 `r1-implementation`。用户已授权持续并行执行、每批上传 GitHub；不再请求重复批准。

## Global Constraints

- 原稿字体：headline-sm 17/22 px、body-md 15/21 px、body-sm 13/18 px、label-md 13/16 px；页面侧距16px、卡内距12/16px、头像圆径32px。采用当前工程 rpx 布局（375px时1px=2rpx），记录该口径，不把不同宽度PNG坐标差视为像素验收。
- 每页保留微信原生胶囊避让、返回及本人数据目标；共用 common.wxss/navigation.js 不在本批修改。
- 所有私有活动继续来源 `/me/events`，保留会话隔离；照片继续标为示意，相册/点赞/评论/人脸识别未开放。
- 存储数字继续来自 wx.getStorageInfoSync；不得恢复虚构容量、清理承诺或一键清空。
- 客服、一般反馈和图片上传未开放；FAQ、发起、举报和隐私请求仍是实际目的地。
- 按用户要求不跑全量，不为低影响样式改动编写照搬实现的测试；只使用相关既有验证、微信工具实点和截图。
- 三名实现者仅修改各自页面和独占素材/报告，不操作共享模拟器，不提交。根代理统一同步、CLI、实点、提交与 GitHub 上传，提交带 `[skip ci]`。

## Task 1: PG10-C moments

Files: `miniprogram/subpackages/profile/moments/moments.{wxml,wxss,js}`、本页 `assets/`、独占 evidence。
- 按审计值修复侧距、卡内距、标题/元信息/筛选/摘要字号、圆标、CTA52px和图片比例。
- 本地轮廓图标替代占位字符，头像复用 itinerary 的白色 person 轮廓写法。
- 从原HTML取得原照片，保存到本页分包assets，按真实活动类型选择 badminton/picnic/boardgame 的原图。原文件保存，不生成替代照片；如下载失败记录真实缺口。
- 既有会话和照片边界定向用例验证；保留正常筛选、详情和发起路线。

## Task 2: PG10-F cache

Files: `miniprogram/subpackages/profile/cache/cache.{wxml,wxss,js}`、独占 evidence。
- 修复主数字28/36px、独立MB单位13px、标题17/22px、条高12px、信息图标40px及CTA48px。
- 头像使用白色person轮廓；真实读取数值、失败占位、最近读取时间和隐私深链保留。
- JS仅在拆分数字/单位所需时增加从同一真实值派生的字段，保留现有格式字段兼容性。
- 仅相关既有storage/页面功能用例；不扩展清理功能。

## Task 3: PG10-G support

Files: `miniprogram/subpackages/profile/support/support.{wxml,wxss}`、必要本页assets、独占 evidence。
- FAQ15/21px和上下12px；标签13/16px、侧14px、gap8px，恢复原稿3+2排布；表单约100px、上传框80px、CTA48px及图标。
- 头像/主要图形使用本地轮廓形式，保留菜单、禁用态、FAQ、举报/发起的实际动作。
- 仅相关既有support/profile路由验证，不修改业务JS。

## Integration

- 独立复核各页面spec+diff，记录真实问题并修复；根代理完整源码同步隔离工程。
- 微信实点每页返回、更多/头像及主动作；moments筛选/同ID详情、cache刷新及隐私深链、support FAQ/发起/举报；截图原稿对照，异常收集。
- 类型/差异/凭证及CLI包体检查。源码与截图证明本批具体区域，不将三页局部证据提升为39屏逐像素或正式上线。
