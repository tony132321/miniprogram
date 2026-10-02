# CAPER 发现普通长页来源恢复 — Wave 74

日期：2026-10-02。实施范围：`pages/discover/discover.wxml` / `.wxss`、18 个准确 SVG、独占来源证据。复用既有工程；未改业务 JS。`discover.json` 中图片组件注册由根代理独占修改。

## 来源与真实功能

已完整阅读并查看用户 ZIP 中 `caper_4/code.html` / `screen.png`，并逐字节核 ZIP 原件：HTML 63,270 B / `514d9e5fbfbbc66e9c5c19cf33767b58b54f77a144720c4b89f3b5248356aed2`；PNG 265,845 B / `15ffd670e926b6f508dac5223bb00e3beee8301a6a712a3836d468893a95d63e`。完整来源在 `docs/design-sources/caper-discover-long-page-wave74/`。

恢复原 11 个长模块的 px 结构：推荐卡、附近地图示意、三条主题横幅、主理人目录空槽、本人活动卡、六格影像拼贴、评价闭态卡、六张每周灵感、三张路线示意、四个场景、底部发起 CTA。新增选择器只作用于 `.d74-long` 和 `.d74-cta-scope`。旧原生状态栏 / 胶囊适配、Wave 64 核心、邀请口令 / 预览 / 扫码、底部 Tab 完整保留。

原稿人物、评论、好友人数、场次日期、距离、商家与 AI 推荐尚无真实功能或事实来源，因此保留明确的空槽、闭态、场景示意和原真实文案。本人活动继续来自既有真实 GET / identity / generation / ID 流程。所有旧 28 个长页动作声明的绑定、参数、禁用条件和 `wx` 祖先条件准确保留；主理人/照片社区/公开评价不增加假入口。原场景与旧 `data-title` 不一致的场馆卡显示实际点击灵感目标，第二路线也明确保留旧“山野徒步”灵感动作，避免替换业务。

## 原图、字体和字形

8 个独立原 URL 响应只在实施前下载一次。7 张现有图共 529,067 B 与原 URL 响应逐字节一致，直接复用；无压缩、缩小或重编码。公园原图 122,735 B / `ab6bc2647289d4dfd98ea1229b2ea0caf5ead4390de18624c61af3e7645db05d` 由根代理放在 profile 分包图片组件，两个消费槽为拼贴第一格与场景第四格，不增加主包照片。

18 个新 SVG 共 18,787 B，由保存的官方 Phosphor web 2.0.3 regular / bold / fill 字体与 CSS Unicode 准确导出，轮廓未舍入，视口 / 颜色准确；横幅透明度由原 CSS `.3` / `.15` 表达。复用准确白色 bold heart 与灰色 regular map-pin；未加入字体或整份库。原生图片使用 `aspectFill`；图标使用 `aspectFit`。

长页 body 沿原 `-apple-system, BlinkMacSystemFont, "SF Pro Display", "PingFang SC", sans-serif`；手写节点沿既有 Caveat 来源及 fallback。一次只读原稿 cascade observation 保存 448 节点 / 11 section，阻断字体和图像二进制，所以证明有效 CSS 属性，不能证明字形实际绘制或换行。原 `from-black/85` 有效；`py-0.2` 与 `shadow-xs` 无效且未自行赋值。

## 一次限定检查

唯一 `targeted-source-check.py` 结果：**138 项来源 / 字形 / 资源 / 绑定 / 保护检查通过**。没有运行全量、历史脚本、业务测试、CSS 镜像测试、CLI 或 SDK。

- 两处 WXML 精确逆替换恢复完整 baseline 15,967 B / `712b837104da4ba86ac372b2a9f2a1bad7b5aff9df40c9fa5b8b14b95f62bc8c`。
- 旧完整 WXSS 21,968 B / `b2e7823086c5f30b69ba25bf1605136e52bcefd0d48cbb94f4c03abb65d32e13` 为精确前缀。
- JS 17,758 B / `928b72be56fca9c7cd4d2a8fd8f76d14632ef9c315dbfb2ea62c97a9c81712b5` 完整未变。
- 页面 JSON 仅根代理新增 `reference-image` 注册 / placeholder，其余 key 与旧 JSON 一致；该文件不属于本代理写入范围。
- 全页旧 event / dataset / disabled / `wx` guards 多重集合一致；28 个长页动作条件和真实 handler 保留；两个异步图片消费 key 准确；所有静态资源实际存在。
- 18 个新字形与 2 个复用字形逐一比对官方 cmap / TTF / CSS / SVG 路径与颜色；完整 HTML / PNG 与用户 ZIP 同字节。

当前 runtime 主包 raw 净增 **54,551 B**（不含根代理 JSON 注册 / 公园分包组件）；无新增主包照片 / 字体。编译尺寸由根代理最终 CLI 判定。

## 根代理最小原生检查范围

只进入普通发现并滚动至新区域：静态推荐换批与收藏闭态；nearby 在 READY 非空 / 空态的真实活动与选城；三主题和六 weekly 原灵感 modal；本人活动卡 ID / 查看全部；评价“我的活动”；两个 route / 四 scene 实际旧目标；底部 `goCreate`。本人活动动态卡需要已登录且有实际活动；另核 `LOADING` / `ERROR` / `READY-empty` / `READY-populated` 的来源边界及公园图片实际绘制。主理人目录 / 社区照片没有真实入口，维持闭态。

## 尚待证据

本报告是来源和代码保护证据，不宣称微信端整图逐像素通过、全部 39 屏完成、真机 / 正式 AppID / HTTPS / 真人运营验收。根代理负责本批独立审查、限定 SDK、CLI、截图与不可变 GitHub 提交。
