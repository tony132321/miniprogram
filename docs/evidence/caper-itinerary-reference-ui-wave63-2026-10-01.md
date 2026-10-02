# 我的行程原稿 UI 对齐（Wave 63，2026-10-01）

本批在现有R1行程页完成原稿明确token的视图恢复，来源为独立差距审计 `docs/evidence/caper-itinerary-reference-gap-audit-wave63-2026-10-01.md`、完整 `_1/code.html` 和以 `view_image` 阅读的 `_1/screen.png`。原图为561×1600；以原HTML的CSS值换算，375px窗口下1px=2rpx，不使用PNG宽度直接推算布局。

## 范围及真实数据

写入限定本页 `itinerary.{wxml,wxss,js}`、新增 `assets/`、本证据以及本地Task 2报告。JS由原计划的字节保持约束补充为仅本页胶囊避让布局修改；下方附完整最小差异及业务代码还原证明。

`/me/events`、本人身份校验、筛选/排序、上海自然日、费用与场地字段、主办审核状态以及报名/签到/详情三种入口仍使用现有实现。全部原条件、字段表达式、`data-id`、交互绑定和ARIA标签保留。首卡与后续卡均渲染真实活动；未加入样本活动、队友、人名、PASS或日历同步承诺。现文案“本页未同步系统日历，也不生成永久入场凭证。”保持。

## 视图恢复

- 主卡标题20px/26px/700、副字13px/18px/400、主体p16；facts p12/gap10、28px/r8图盒和18pxglyph。主事实13px/16px/600，日期提示11px/14px/700，地点/费用提示13px/18px/400，真实长字段保留换行空间。
- 封面仍176px，动态类别封面选择和全部6张JPEG字节保持。下渐变为白色100%→中段on-surface 20%→透明；倒计时与本人活动徽标使用源padding/gap及16px F1 timer/15px F0 verified。
- 场地提示p12/gap8/r12、18px F0 info；真实状态标题11px/14px。现报名、签到与详情按钮保留，作为R1真实交互适配，主卡总高由真实内容决定。
- 后续小节标题17px/22px；卡p12/gap12/r16，日期48×48px/r12；标题17px/22px、说明13px/18px、状态11px/14px/p2×8胶囊。`wx:for-index="itineraryIndex"`仅使现粉/紫日期盒按索引交替；真实`item.stateLabel`及现浅蓝状态色保持，未将源样本状态赋给真实记录。后续详情箭头和整卡入口保留。
- 本人活动说明恢复p12/r16/gap12、32px白圆与20px F1 check_circle，作为现有诚实说明的装饰。intro及footer字级依源明确token恢复。
- 顶栏行56px、返回触区44px、头像32px、左gutter16px，官方back22px/person18px替换符号与CSS人形。Wave56已完成白色人形与真实个人路由；本批补全同名官方资源和源几何，未重复实现或重跑该业务路由。

## 顶栏布局 JS 例外与平台边界

实施前JS仅有`statusBarHeight`，胶囊留白实际是WXSS固定`padding-right:200rpx`，并非已有动态JS预留。按root补充授权，复用工程信息页同一`headerPaddingRight()`计算，右侧预留`ceil(windowWidth - menu.left + 8)px`；缺失、异常或不合法API值回退112px。`data/onLoad/onShow`只更新该布局字段，WXML顶栏内联padding使用它。

该helper与 `miniprogram/pages/about/about.js` 逐字相同。去除helper及3处布局字段更新后，JS文本逐字还原为实施前源；请求、时间、筛选、身份、状态和导航函数保持。整份JS hash已变，因此不再宣称整份JS字节保持。顶栏在实际statusBarHeight下使用sticky，配fixed状态cover（height绑定同字段、pointer-events:none），保留页面实际状态栏padding。将源网页fixed头适配为sticky，使返回/个人入口滚动后仍驻留顶部。rpx值仅在375px窗口对应上列CSS px；实际胶囊净距、SVG显示、backdrop-filter兼容性和字体轴由root后续模拟器检查。

```diff
--- Wave62 itinerary.js
+++ Wave63 itinerary.js
@@ -1,5 +1,15 @@
 const { api } = require('../../../utils/api.js');
 const config = require('../../../config.js');
+
+function headerPaddingRight() {
+  try {
+    const menu = wx.getMenuButtonBoundingClientRect?.();
+    const width = (wx.getWindowInfo?.() || wx.getSystemInfoSync?.() || {}).windowWidth;
+    if (Number.isFinite(menu?.left) && Number.isFinite(width) && menu.left >= 0 && menu.left < width)
+      return `${Math.ceil(width - menu.left + 8)}px`;
+  } catch (_) { /* Keep space for the native menu on older clients. */ }
+  return '112px';
+}

 function currentIdentity() {
   const token = wx.getStorageSync('sessionToken');
@@ -59,9 +69,10 @@
     (item.myRegistrationStatus === 'CONFIRMED' || item.isHost);
 }
 Page({
-  data: { statusBarHeight: 24, loadState: 'IDLE', message: '', featured: null, later: [], total: 0 },
-  onLoad() { this.setData({ statusBarHeight: wx.getSystemInfoSync?.().statusBarHeight || 24 }); },
-  async onShow() { return this.refresh(); },
+  data: { statusBarHeight: 24, headerPaddingRight: '112px', loadState: 'IDLE', message: '', featured: null, later: [], total: 0 },
+  onLoad() { this.setData({ statusBarHeight: wx.getSystemInfoSync?.().statusBarHeight || 24,
+    headerPaddingRight: headerPaddingRight() }); },
+  async onShow() { this.setData({ headerPaddingRight: headerPaddingRight() }); return this.refresh(); },
   onHide() { this._generation = (this._generation || 0) + 1; this._shownIdentity = null; },
   onUnload() { this._generation = (this._generation || 0) + 1; this._shownIdentity = null; },
   async onPullDownRefresh() { await this.refresh(); wx.stopPullDownRefresh?.(); },
```

## 官方资源 inventory

源HTML共有9个同名Material Symbols Outlined span。本页导出9份本地SVG：6个主卡字符替换，另3个为check_circle/back/person。固定官方commit `bd8cb85bd4bad964fe6918f79665bb40c3a8efef`，axes为outlined/wght400/GRAD0/opsz24；FILL及颜色见下表。全部由原 `export_symbol.py` 缓存原子管线生成；无404、无字体fallback、无共享proof写入、无字体进入包。每项精确source URL、source SHA-256、asset SHA-256均存本页 `assets/material-symbols-sources.json`。Apache许可复用 `docs/licenses/material-symbols-Apache-2.0.txt`。

| 原名 | FILL | 色值 | 显示px | 资产SHA-256 |
|---|---|---|---|---|
| `timer` | 1 | `#FF2D55` | 16 | `c9af56a9458ee4b7fd22b42d0b5457481ab6240471cb51ac396b8d3e25f029e6` |
| `verified` | 0 | `#004cc8` | 15 | `3c17f5c6fc7ca9a3c980c40b2ee21f945a275b662d74f98c5d70561bdaa52653` |
| `calendar_today` | 0 | `#1D64F2` | 18 | `963b2f6ca1ab6a31bffaaac553a98b6225174aee78bf84cd9ad380e0b6f4b9f7` |
| `location_on` | 0 | `#4d5d00` | 18 | `65f88e9064f60164f7fc0912a142b73c305bf1ef2562a82571d8284c065fe519` |
| `payments` | 0 | `#5856D6` | 18 | `57cf2d2a7177c473bbabefa8f2ae0dd219cd63a3f57250128eb252ca3cf35c60` |
| `info` | 0 | `#424655` | 18 | `cafa24009f60176386f7c80ad532e7fe0df28e3c623d752ec0ddbc9a21122c4c` |
| `check_circle` | 1 | `#34C759` | 20 | `40e24a1c9c2512991e3b57ba7daa8862ea103ef308ed8dc612533d9d61e8bb76` |
| `arrow_back_ios_new` | 0 | `#1a1b1f` | 22 | `b4d72b3ef91399480f63d49489df5b8ff1b26436974b423b3c60d11b103ff854` |
| `person` | 0 | `#ffffff` | 18 | `d66a89fc9036f18a31f3804ee7b19f52a7954e31cc1cbfbd9b98f206a8299d6f` |

## 一次必要自检的实际结果

静态检查exit0：原HTML/PNG hash与审计一致；9个源名字与9份manifest inventory一致，固定commit/axes/FILL/URL/颜色/hash有效，SVG XML有效，去根fill后全部SVG属性和path与固定源相同；WXML在声明wx命名空间并转义XML字面&后可解析；9个本地资源引用均存在。原条件/绑定/`data-id`/ARIA标签集合逐项相同，全部原字段表达式保留，仅新增顶栏布局表达式和日期装饰索引表达式。6张类别JPEG hash保持，业务JS最小变更还原成立。

新增顶栏初始化完成5种必要VM检查，未新增镜像测试或运行全量/行程业务矩阵。首次shell的`node`未在PATH（exit127），通过desktop workspace dependency工具定位bundled Node后，仅重跑这项失败检查，exit0。`onShow`均调用原refresh一次并返回其结果：

| 初始化场景 | onLoad右预留 | onShow右预留 | refresh调用 |
|---|---|---|---|
| valid native menu then changed window on show | `103px` | `102px` | 1 |
| older client window API fallback | `103px` | `103px` | 1 |
| missing optional APIs | `112px` | `112px` | 1 |
| invalid native menu left | `112px` | `112px` | 1 |
| native menu throws | `112px` | `112px` | 1 |

本代理未调用Git、微信CLI、SDK、Automator或CUA。证据仅覆盖源与资源及新增header生命周期初始化。root定向指出源头部fixed后，本代理只针对新增sticky/top绑定/fixed cover/无交互及XML结构补充检查，exit0；未重跑资源或业务矩阵。独立source复审、root实际本人首卡/后续记录布局、同id详情往返、编译与模拟器净距和滚动检查尚待集成；若账号实际不足两张后续卡，应报告记录限制。真机、外部服务和生产验收均未取得本批新证据。

## 冻结文件hash

| 文件 | Wave63 SHA-256 |
|---|---|
| `miniprogram/subpackages/activity/itinerary/itinerary.wxml` | `0d66c8b675decf27bc57511d7b0935c6883438bf2dededdf26e6820d0affaeea` |
| `miniprogram/subpackages/activity/itinerary/itinerary.wxss` | `42faee430c7d58612c8e1c8e2f8560f8c5f1ce4c01e00de65bdf8f5e74271cf9` |
| `miniprogram/subpackages/activity/itinerary/itinerary.js` | `5c0e933ed6a67b7bc90d7d1f6510e84d22ecf9d9abd006456fe787dead8e61c7` |
| `miniprogram/subpackages/activity/itinerary/assets/material-symbols-sources.json` | `708c6d076db64c127bbfb2043baa8e574401e7c2334b66adf1856f5748029261` |

实施前JS SHA-256：`11a0807e6fa4882e81a268aea9f4149f94e5b6204dc758cb715b2c66d1b764f6`。

| 保持字节的类别JPEG | SHA-256 |
|---|---|
| `miniprogram/assets/stitch/itinerary_badminton.jpg` | `6dff9b8ed669c73e1ee9ea1997af6c7da3383e59dd8ec1b32c516ddbdff6d7e7` |
| `miniprogram/assets/stitch/caper_discover_basketball.jpg` | `e38ebfbe65bad920fcfd9861f82b4d3c558bf8584dffbd237b1cd5a8ee1a35a2` |
| `miniprogram/assets/stitch/caper_discover_coffee.jpg` | `8c0b55f856d8fbf2fc565b240aff905bcd4a8a0fdc5db4e2047591bebb71d07e` |
| `miniprogram/assets/stitch/caper_discover_art.jpg` | `84a0a5c6ce78fe0918d7edbaf75f010a2b255f239219344a8e65e10850745bbd` |
| `miniprogram/assets/stitch/caper_discover_boardgame.jpg` | `0496a27ec5e007deba173ce6a54c882fadba2d882babf0010a3b7ade1116a070` |
| `miniprogram/assets/stitch/caper_discover_citywalk.jpg` | `29ec54d0a3ad4928008e957d8229c72d0a357167098d458d749c4d391d09faa2` |
