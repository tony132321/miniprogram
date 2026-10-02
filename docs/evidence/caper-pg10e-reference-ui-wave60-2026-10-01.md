# PG10-E 原稿恢复 · Wave60 · 2026-10-01

范围：仅 `miniprogram/subpackages/profile/legal/legal.{wxml,wxss,js}` 与页面独占 `miniprogram/subpackages/profile/legal/assets/`。对照 `/private/tmp/irl-ui60-profile-de-audit/stitch_design_system_generator/pg10_e/code.html`、直接查看原 PNG，并读 `caper-pg10d-e-visual-gap-audit-wave60-2026-10-01.md`。

## 源码恢复

375px 下 1px=2rpx：56px 顶栏、44px 返回/更多触区、32px 头像；17/22px 标题、15px/1.625 正文、13/18px 子卡、11/14px 标签；16px 页面与正文侧距、12px 卡间与圆角、32px 编号圆。

摘要恢复白色外卡中的文档元信息与渐变内摘要两层结构，28px 蓝色 auto_awesome 圆；真实摘要保留完整阅读文字，未用截断掩盖必要事实。四页签为圆胶囊横滑轨道。照片尚未开放说明放入原风格信息子卡。请求卡恢复40px蓝色 shield 圆、17/22px标题、13/18px说明。底部恢复 sticky、玻璃背景、safe-area padding、等宽48px按钮与完整真实状态脚注。

当前服务说明、正式协议待核定、正式生效日期待核定、第三方清单未发布与禁用 PDF 保留。未植入原稿认证、示例日期、DPO、邮箱、响应时限、位置轨迹承诺、即刻匿名化/7日销毁或确认同意。Aa handler、原生公开分享、真实更多菜单、社区公约、本人隐私请求路线保持。JS 唯一改动为锚点顶栏偏移92rpx→112rpx。

## 官方资产

14个独占 SVG 源自 Google Material Symbols Outlined，固定 commit `bd8cb85bd4bad964fe6918f79665bb40c3a8efef`，路径完整记录于 `miniprogram/subpackages/profile/legal/assets/material-symbols-sources.json`；仅变更 SVG 根 fill，glyph path 不变。auto_awesome 使用原 FILL=1，其他 FILL=0；字体不依赖外链加载，Plus Jakarta Sans 后接平台中文回退。授权引用 `docs/licenses/material-symbols-Apache-2.0.txt`。全部符号成功取得，无404和自绘替代。

## 相关既有验证

运行 `node --import tsx --test test/pg10-legal-cache.test.ts test/miniprogram-pg10e-permissions-tab.test.ts`：5通过、2失败。失败均为旧源码形状/几何断言：permissions-tab 第一项要求 PDF 按钮直接文本（现在是官方 download image + text，禁用与文案仍保持）；第二项期望522（旧46px顶栏），现在512（新56px顶栏）。测试文件未修改，交由集成者审查更新。

再次运行 `test/pg10-legal-cache.test.ts`：5/5通过，包括真实隐私/公约路由、正式协议未发布、字号开关和缓存既有行为。

本实现者未操作模拟器、未跑全套、未提交；此文为源码与相关CLI证据，不宣称真机、39屏或逐像素验收。根代理须验证横滑权限定位、Aa、原生分享、更多菜单和底栏实点、截图、包体。

## 集成补充

根代理校准两条旧 permissions-tab 断言：保留 PDF 禁用与完整文案校验，允许官方图标及 text 包装；定位期望由旧顶栏的522更新为新56px顶栏的512。该文件定向2/2通过。14个图标与 manifest 已迁入页面个人分包，引用改为相对路径，独立复核散列未变且所有引用存在。模拟器结果另见本批总证据。
