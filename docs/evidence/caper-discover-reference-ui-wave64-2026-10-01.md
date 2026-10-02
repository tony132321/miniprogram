# Wave64 发现页原稿首组件恢复证据

日期：2026-10-01。对应 accepted plan Task2，基线 `d66bdba36e3028aff2e833d6aa9973be3713da37`。本文件记录源码实现、原字体取证和一次有限静态检查；尚未给出微信原生视觉或路由通过结论。

## 原稿与边界

已完整阅读 `docs/superpowers/plans/2026-10-01-core-tabs-reference-ui.md`、Wave64 scope audit、Task2 brief、原 `caper_4/code.html`、原整页 PNG、当前完整 WXML/WXSS/JS 及 app.wxss。原 HTML hash `514d9e5fbfbbc66e9c5c19cf33767b58b54f77a144720c4b89f3b5248356aed2`；原 PNG hash `15ffd670e926b6f508dac5223bb00e3beee8301a6a712a3836d468893a95d63e`，PNG 176×1600 是缩小长图，未用其宽度推导尺寸。原 HTML 的 viewport / max-width 为390px，本页原生窗口使用 width 100%，所有本次恢复的来源字级、固定控件、封面、gap、padding、圆角均为原 CSS px 字面值。

仅修改发现顶栏、分类、四主灵感卡和对应页面资产，新增 Phosphor 取证与MIT许可。`discover.js` 完全未改；从 `discovery-entry-strip` 起的 WXML 后半页逐字节相同，所有范围外有效 CSS 规则相同。继续保留真实邀请、本人活动、当前身份、能力关闭状态与长页各入口。公共导航、其他页、总验收矩阵、WeChat CLI/SDK/CUA、Git及上传不在本实现者操作范围。

## 几何与图层恢复

| 组件 / 原 HTML 行 | 本次有效 CSS / WXML |
| --- | --- |
| 顶栏 89–125 | relative；原生 header/shield 56px；左距16px，原 top4/bottom12；statusBarHeight及既有 headerPaddingRight() 胶囊预留继续绑定 |
| 品牌 94–100 | Logo32px/文字14px/圆形；logo gap8px；中文20px/900/line28，CAPER12px/800/line16/letter .05em；内文字gap4px |
| Context 105–107 | 16px/700/line16，副句10px/line15/margin2；remaining flex宽度内副句ellipsis是原生胶囊适配；未缩小源字号 |
| 搜索/筛选 110–115 | 原32px按钮、gap12px、18px Phosphor Bold 原字形/源#334155；原 showUnavailable 数据与绑定保持 |
| 贴纸 120–122 | right24/bottom-10、p2×8、r4、10px/900、rotate3、原lime/black与shadow-sm |
| 分类 129–139 | sticky top为statusBarHeight+实际56px；12px/line16，全部p6×16，其余p6×14，gap8、top12/bottom10、white95%与blur12；原类别数组与 selectCategory 保持 |
| 四卡 144–269 | 原inset12/gap12/r16/1px border、shadow-sm；照片固定176px；body p10；标题14/line1.375、副文11、事实10；section top16/bottom8 |
| Overlay / sticker 148/180/210/240 | 城市gradient bottom80/mid30/top20；篮球85/40/20；咖啡/桌游85/40/transparent；覆盖层z10、字/收藏/标签z20，未添加源稿没有的text-shadow |
| 贴纸字级 148/180/210/240 | CITY/WALK20 +TOGETHER12；篮球kicker12/主文18；咖啡12/16；桌游12/14；颜色、line-height、letter spacing和源层级按每节点恢复 |
| 收藏/标签 | 收藏28px/top10/right10/heart bold14px；标签left8/bottom8/p2×6/font10，原fill glyph9px与逐卡源颜色 |
| 正文/底栏 | body10、copy top4、facts top8/gap2/icon gap4；foot top12/paddingtop8/1px border/font10，逐卡源amber/emerald/orange主题色；保留当前实际标签/无报名文案 |

原 `.discover-main` 后半页24rpx内边距继续保持；首卡 grid 的 `margin: 0 calc(12px - 24rpx)`只抵消原承载容器的内边距，最终四卡逻辑水平 inset 恒为原12px。分类的外框 likewise 抵消既有 main carrier，其分类行 inset 为源12px。未对长页改换单位。原附近定位函数已动态测量 `.category-scroll` bottom，没有 JS 固定92rpx，故本次只修正 WXML sticky/top 与 header/shield 同56px，不改变 JS。

原CITY备注声明 Caveat/Segoe Print/cursive，但原稿未加载该字体文件，本次也未把未加载的字族声称为已匹配；系统SF/PingFang fallback 字体的最终原生渲染待 root 测量。TTF来自图标取证，不是文本字体。

## 精确 Phosphor web2.0.3 取证

源 `code.html:38` 指向固定 npm 包 `@phosphor-icons/web@2.0.3`。官方registry tarball的SHA512 integrity与SHA1 shasum均校验成功，记录在 `docs/design-sources/phosphor-web-2.0.3/package-integrity.json`。三套原CSS/TTF、package/registry metadata、原HTML、完整font name表、version、hash与MIT字节已留存。npm版本2.0.3与font内部 `Version 2.0` 分别记录。

| 名称 | 源样式 | Unicode | Glyph | 源大小 | 源颜色 | 原HTML glyph行 |
| --- | --- | --- | --- | --- | --- | --- |
| magnifying-glass | bold | U+EBDD | uniEBDD | 18px | #334155 | 112 |
| funnel-simple | bold | U+EB3C | uniEB3C | 18px | #334155 | 115 |
| heart | bold | U+EB8A | uniEB8A | 14px | #ffffff | 148, 180, 210, 240 |
| compass | fill | U+EA63 | uniEA63 | 9px | #60a5fa | 148 |
| barbell | fill | U+E993 | uniE993 | 9px | #c6ff00 | 180 |
| fork-knife | fill | U+EB37 | uniEB37 | 9px | #fbbf24 | 210 |
| game-controller | fill | U+EB3D | uniEB3D | 9px | #c084fc | 240 |
| calendar-blank | regular | U+E9E4 | uniE9E4 | 10px | #94a3b8 | 155, 187, 217, 247 |
| map-pin | regular | U+EBE0 | uniEBE0 | 10px | #94a3b8 | 159, 191, 221, 251 |

共9 glyph：bold3、fill4、regular2；源系统模拟状态及共享底栏不计入本任务。Font em/advance为1024，ascent960/descent-64；SVG只用 `(1,0,0,-1,0,960)` 转换原font坐标至1024 line box。一次校验直接从保留TTF重取相应CSS Unicode的原outline，与SVG完整path逐字节比较；无重画、简化、替换家族或shape crop。每个asset/path/color/style/unicode/source line/hash在页面清单与docs source.json交叉一致。

页面仅新增9个SVG，合计8625bytes，另页面source manifest记录资源出处；字体文件及CSS仅docs取证目录，页面不含也不引用TTF/WOFF。许可证 `docs/licenses/phosphor-web-2.0.3-MIT.txt` 为原包MIT字节。

四照片路径/顺序/已有字节未修改，R1原 `inspirationCards` 与tags/sticker数据完全保留；没有补入参考日期、场馆、参与数、头像、公开主理人或评价。依旧“暂无活动时间 / 暂无真实场地 / 仅供构思 · 暂不可报名”；搜索/筛选/收藏原关闭状态handler、发起确认与授权本人卡均继续复用。

## 本次有限检查

检查结果 **PASS**。使用 bundled Python 和先前只读 FontTools4.60.2，执行一项合并 source/assets/XML/refs/font-outline/binding 检查。第一次静态selector分类把新CSS注释当成selector，修正检查器先去注释后，完整检查通过；没有产品缺陷或额外业务重跑。XML检查只是把wx命名空间/布尔attribute标准化供XML parser读取，不代替微信编译。

- JS byte等于基线hash `9644a52f186b3f5ce3b99389849571f8a8110c3a3045c70f383ee407c7c9592a`。
- 原110项id/bind/catch/data/wx/disabled/value/aria契约和72项原mustache表达式全部保留；仅增加装饰glyph选择条件和图片。
- 原后半WXML tail完全相同、范围外CSS规则相同；旧92rpx已全部移除，56px sticky字段与header/shield一致。
- 当前16个静态src路径全部存在，9个SVG XML有效；三CSS/三font/hash/Unicode/node行/完整outline/path/color与清单一致。
- 所有TTF/WOFF排除于页面新增assets；未跑业务/邀请矩阵、全量本地/CI测试或微信运行验收。

Root仍需按accepted plan局部验证：原生header/capsule、四封面与glyph/分类几何；搜索/收藏关闭、全部清提示；附近滚动目标可见/城市返回；一个当前授权本人活动的同ID路由。原整页余区、一切39屏逐像素、真机、正式AppID/HTTPS/订阅消息/真实运营仍不由本静态证据通过。

## Freeze 产品文件

| 文件 | bytes | SHA-256 |
| --- | --- | --- |
| `miniprogram/pages/discover/discover.wxml` | 15967 | `712b837104da4ba86ac372b2a9f2a1bad7b5aff9df40c9fa5b8b14b95f62bc8c` |
| `miniprogram/pages/discover/discover.wxss` | 21968 | `b2e7823086c5f30b69ba25bf1605136e52bcefd0d48cbb94f4c03abb65d32e13` |
| `miniprogram/pages/discover/assets/ph-barbell-fill.svg` | 1163 | `d0abea57e21e83264b21b45bc5ca2bd30d506c1d9c8fde8769dc0ecd2e1328e8` |
| `miniprogram/pages/discover/assets/ph-calendar-blank-regular.svg` | 650 | `f2205e7bb7a35c9fd3cc56a1bcb63b96cb29d94838d52b3680e73d9fd2df22de` |
| `miniprogram/pages/discover/assets/ph-compass-fill.svg` | 722 | `c5607060e580011be2cc0a6f3e8ecf76162862789d5652fa3e6f2e79f06b95b3` |
| `miniprogram/pages/discover/assets/ph-fork-knife-fill.svg` | 997 | `6f18d2b0568fd57a6c29d8ca1efff1df0968effae485d92a45ee8f004a9db299` |
| `miniprogram/pages/discover/assets/ph-funnel-simple-bold.svg` | 595 | `fb7be574f5e7431bce225684733ef8e37af58e43d5be2ed75d4a56b7be43a08e` |
| `miniprogram/pages/discover/assets/ph-game-controller-fill.svg` | 1552 | `91b70926b816b4f4e9b29000f8c77fc8ba9054a8a70fad7f48e68631634b6a08` |
| `miniprogram/pages/discover/assets/ph-heart-bold.svg` | 990 | `cc384fd9dae4781155ba9cb0639c2677eba89f6a7e68b1e0fdf0efc0e0b92360` |
| `miniprogram/pages/discover/assets/ph-magnifying-glass-bold.svg` | 813 | `509702096ab16a0fd1fe24372ff963aef0b935a3c0f26120d04da9e5c99e5c01` |
| `miniprogram/pages/discover/assets/ph-map-pin-regular.svg` | 1143 | `0ef0349cab3091ab3fab8f37af6052f56ad15c466a30cbfe700f5d609308bc27` |
| `miniprogram/pages/discover/assets/phosphor-sources.json` | 8205 | `f4f229a006e06bd1388752ac0921d07ddb3415251ec64bfebd3fb7d1588382d2` |

## Freeze 字体取证与许可

| 文件 | bytes | SHA-256 |
| --- | --- | --- |
| `docs/design-sources/phosphor-web-2.0.3/README.md` | 2643 | `5ce70b5d0ecf7b1c256750a1435fd81ad3581592b9406f15d1c6d12e1d1c7f2d` |
| `docs/design-sources/phosphor-web-2.0.3/bold/Phosphor-Bold.ttf` | 344736 | `b0b27f810a2646b0b48d243b119bc4f3ed727f1e4162e05bfe6e4f85018f4b7b` |
| `docs/design-sources/phosphor-web-2.0.3/bold/style.css` | 70315 | `c2b4f3dbe9960e4ed9ffa0c78b19a2210f946cfb4bb01b53b4fce64afaee2961` |
| `docs/design-sources/phosphor-web-2.0.3/caper_4-code.html` | 63270 | `514d9e5fbfbbc66e9c5c19cf33767b58b54f77a144720c4b89f3b5248356aed2` |
| `docs/design-sources/phosphor-web-2.0.3/export-source-glyphs.py` | 6791 | `92c610118dccdf6d3be97f51284c2ce5ed1ec03e5973035d8c74552dfdca4b8b` |
| `docs/design-sources/phosphor-web-2.0.3/fill/Phosphor-Fill.ttf` | 302548 | `3a8fd92374be66aa4c58db0caea81d3be4b6058288351550bcb4f946ae324267` |
| `docs/design-sources/phosphor-web-2.0.3/fill/style.css` | 70315 | `2d2b5281299a3a849ac8d3ceb42b8e3107b820c20e4e82687bfc8ec4f7e9a0fc` |
| `docs/design-sources/phosphor-web-2.0.3/package-integrity.json` | 481 | `7f3d5ec7bf109af081b36f42b1e197780d464ec46e7b603123fe41c26d1232f1` |
| `docs/design-sources/phosphor-web-2.0.3/package.json` | 1133 | `fc7104ac532e318d2f666e69ac4f47d3e41f12f230958d715fde56e1c3fa2328` |
| `docs/design-sources/phosphor-web-2.0.3/registry-version.json` | 3774 | `d5a256d72afff2a960d217c76ad5c55ed5f4ebf7498771fa4158957e98de16de` |
| `docs/design-sources/phosphor-web-2.0.3/regular/Phosphor.ttf` | 351212 | `83034c352ef88208a6433526ebe04139caa3fabc28912c465992d791e29a4593` |
| `docs/design-sources/phosphor-web-2.0.3/regular/style.css` | 63985 | `ae360472b03f686e8327d0440ac943bbf3e25ae3a833e7ff530aef1ce33ab44d` |
| `docs/design-sources/phosphor-web-2.0.3/source.json` | 11301 | `d29dd780680e859a03f3777d8d36ed83edbda2bc59839c760c3fc329659b99df` |
| `docs/licenses/phosphor-web-2.0.3-MIT.txt` | 1076 | `687fbe52d0eb5c2353eca27a4037e889145ee0b584d3b1abf67581c4a4a4e47c` |

## 保持的四照片字节

| 文件 | SHA-256 |
| --- | --- |
| `miniprogram/assets/stitch/caper_discover_citywalk.jpg` | `29ec54d0a3ad4928008e957d8229c72d0a357167098d458d749c4d391d09faa2` |
| `miniprogram/assets/stitch/caper_discover_basketball.jpg` | `e38ebfbe65bad920fcfd9861f82b4d3c558bf8584dffbd237b1cd5a8ee1a35a2` |
| `miniprogram/assets/stitch/caper_discover_coffee.jpg` | `8c0b55f856d8fbf2fc565b240aff905bcd4a8a0fdc5db4e2047591bebb71d07e` |
| `miniprogram/assets/stitch/caper_discover_boardgame.jpg` | `0496a27ec5e007deba173ce6a54c882fadba2d882babf0010a3b7ade1116a070` |
