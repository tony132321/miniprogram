# PG10-H／H1／H2／H3 原稿差距审计（Wave 62，2026-10-01）

本报告是独立只读原稿审计。已读取四份完整 HTML、查看四张原 PNG，并核对当前对应页的 WXML、WXSS、JS、JSON、个人分包共享样式／导航及工程依赖元数据。只新增本报告；没有修改产品、共享文档、模拟器或 Git，没有运行测试、编译或下载资源。当前产品 Wave 61 由根代理另行负责。

## 来源与快照

原稿缓存根：`/private/tmp/irl-ui62-reference/`。PNG 是纵向导出图，各图宽度不同，不能把图中像素距离直接当作统一 375px 设备的 CSS 距离。本报告的显示尺寸取自 HTML 的明确 Tailwind token，当前 `rpx` 按 **375px 窗口宽、2rpx=1px** 换算；未取得当前微信运行时布局。

| 原目录／当前路由 | PNG 原始尺寸 | HTML SHA-256 | PNG SHA-256 |
|---|---|---|---|
| `pg10_h_project_irl` → `/pages/about/about` | 514×1600 | `e29a2c86dc0f3584009a8b37268fba472325ff5f748c65df4e886881a815bad9` | `eaa063182ba0a61e2a7b7d0cc649d24730a6152557cfd063a9c8bd62ebed6a1d` |
| `pg10_h_1` → `/subpackages/profile/release-notes/release-notes` | 287×1600 | `ef395c24605f58944d0e7e962fbd36735d0712adc0a57271015363e7b7ef4824` | `f794a8dceeae1eaf35b77875be67a4ce06d7f26423141af93f6c187f2fe13ade` |
| `pg10_h_2` → `/subpackages/profile/guidelines/guidelines` | 383×1600 | `0a7871c7b3ab496e593b9f41cc493b711160c43dbcc4932debb5afbfd81b3fc0` | `5f3d160c6f91b4025bfe68b5016853492992396dbd219c8cfa24abca9b99e212` |
| `pg10_h_3` → `/subpackages/profile/open-source/open-source` | 348×1600 | `1375e6dbe0acb545c85553314dbea919eee7b8054136e149074ddae612089b0a` | `29afed29a2d39bd2636199f41ef6848b00802ebf648d5bcdeccc754b6f46b362` |

当前页文件位于 `miniprogram/pages/about/about.{wxml,wxss,js}` 与 `miniprogram/subpackages/profile/{release-notes,guidelines,open-source}/` 各自同名文件。审计时字节散列如下，用于后续实现前核对并发漂移：

| 页 | WXML SHA-256 | WXSS SHA-256 | JS SHA-256 |
|---|---|---|---|
| H | `5f0ffc9c969a1f4d1d457571210f954fe3ae4c2f2d31120b5fd583b877e257f9` | `b4826bc86bdaf8004330986b3ceede9f6382b035974f36dcc572383cbe9682cd` | `71c436bcc97d4608fee8f79e3effec34c2876dd2317975f546d36e052bc3e5ad` |
| H1 | `c24fa735924cff500030befdbab89ea3a9e06ab4d5e82525041944e837663565` | `a9f19ced5f18413d59a9ac4800b9b69f58fde2a094babac2e611d11c95ca0251` | `73934228fc72f8f43736942518a89bf08b35ae6421c7564b3d81acf87d6bde4a` |
| H2 | `a19910c18653e93136d1be0ff4a0b9a3fd836f1b335092e3ac035e5ea7b0f517` | `43ceebc8e6bac6218b222738402621fa26a25a0c1fc74cb14197b0dfc1003d4e` | `9aecd0990288300443e88690a13c7405cbe7e34f2fc8811397a137bfae157cd2` |
| H3 | `72ba0f9e1675862dc1d09cc8f611d392ad71c2131310b2154604c745ac58acee` | `1d8645f36e1ced4bc649c2311881c433e26597ad64eb064506aa9463d5c95925` | `a6833658f2968a2ecb3fdf9fd2d84748d3a8ef93930bdacdac37b7efec063393` |

## 符号规则与四页头部

四稿字体族均为 **Material Symbols Outlined**。下表 `F0` 是源 span 未显式设置 FILL 的默认0，`F1` 是明确 `font-variation-settings: 'FILL' 1`；色值由源 span 或父元素的 token 继承。显示 px 是图形布局框的 CSS 字号，不是 path 黑色像素的包围盒。源 H 返回还附 `font-semibold`，现有管线固定 wght400／GRAD0／opsz24；本次未读取原浏览器最终字体轴，不能把固定轴输出声称为所有字体轴已逐像素等同。

共 **75 个静态 Material span**：H 19（17种名字）、H1 24（22种）、H2 21（21种）、H3 11（11种）。H 的原脚本另含 `refresh`／`done_all` 两种动态 span，不计入静态75个。下面逐项保留原名，不用语义相近图标代替。

| 页／HTML行 | 精确原名 | FILL／源色 token → 色值／显示px | 当前目标 selector 与差距 |
|---|---|---|---|
| H:10 | `arrow_back_ios_new` | F0／`on-surface` → `#1a1b1f`／24 | `.about-header > button[bindtap=back]`：字符 `‹`，按钮37px宽、24px字体。源44px触区内部 **justify-start**。 |
| H:10 | `more_horiz` | F0／`on-surface` → `#1a1b1f`／22 | `.about-header-more`：字符 `···`，24×27px触区、16px字体；源44×44px。 |
| H:10 | `person` | F0／`on-primary` → `#ffffff`／18 | `.about-header-avatar`：字符 `人`、圆27px；源圆32px，背景 `primary #004cc8`，当前 `#064dca`。 |
| H1/H2/H3:9，各1枚 | `arrow_back_ios_new` | F0／`on-surface` → `#1a1b1f`／24 | 每页 `.pg10-back`：字符 `‹`，继承37px宽。三源均44×44px **justify-center**；与 H 返回的左对齐不同。 |
| H1/H2/H3:9，各1枚 | `ios_share` | F0／`on-surface-variant` → `#424655`／22 | 每页 `.pg10-header-share-icon`：CSS半框+字符 `↑`；24×27px触区。保留 `open-type=share`、原 aria-label 与现 JS 分享 payload。 |
| H1/H2/H3:9，各1枚 | `more_horiz` | F0／`on-surface-variant` → `#424655`／22 | 每页 `.pg10-header-more`：字符 `···`、24×27px触区；源44×44px。 |
| H1/H2/H3:9，各1枚 | `person` | F0／`on-primary` → `#ffffff`／18 | 每页 `.pg10-header-avatar`：字符 `人`、圆27px；源圆32px、背景 `primary #004cc8`。 |

四页源头部行均 `h-14`=56px，当前均92rpx=46px；源标题17px／22px600，当前 H15px、H1/H2/H3均12.5px。源 H 是 `surface #faf8fe`，透明头部85%；其他三页正文是 `surface-canvas #F5F6F8`，透明头部80%。当前 H1/H2/H3 `#f4f5f8`、共享头部 `#faf9fd`，状态栏上方依赖页根背景，宜局部显式恢复源 surface 底色，再在内容层使用 canvas。

原稿只提供网页 `pt-safe`，**没有微信原生胶囊**。现四页 JS 的 `statusBarHeight`、`headerPaddingRight()` 与兜底112px已经用于原生胶囊避让，不应直接删掉以对齐 PNG。扩大44px触区与32px头像后，375px下 H1/H2/H3 的分享、更多、头像加胶囊保留区会显著压缩标题；保留 `flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis`，检查实际标题、按钮与胶囊均不重叠，必要的微信布局适配单独记证据，不能缩图标到文字字符大小后声称原稿一致。更多菜单的 `top:86rpx` 也须随56px头部校准，实际菜单/返回/头像绑定保持。

源 H 头部标题是 `Edit Profile`、H3是 `Expense Breakdown`，正文却分别是“关于”和“开源许可”。当前中文标题准确反映正文，属已有语义适配；不要仅凭这两个导出模板标题改变页面用途。H1 `Meetup Info`、H2 `Safety & Guidelines` 已与当前头部文字一致。标题差异应明确记录，不能把整页称为无差别复制。

## H：关于页、原品牌 SVG 与符号

| HTML行 | 精确原名 | FILL／源色 token → 色值／显示px | 当前目标 selector／处理边界 |
|---|---|---|---|
| 55 | `check_circle` | F0／`status-active-green` → `#34C759`／14 | `.candidate-pill` 现在 `◉ 功能状态见下方`；原“已是最新版本”无真实更新服务，**不恢复已核验更新状态**。 |
| 63 | `format_quote` | F0／`electric-blue/10` → `#1D64F2`、opacity0.1／80 | `.manifesto-card` 缺原右下角引号装饰（right/bottom -12px）。可局部新增非交互装饰。 |
| 67 | `favorite` | F0／`on-primary` → `#ffffff`／18 | `.manifesto-icon` 字符 `♡`，当前25px方盒、16.5px字体；源32px方盒、12px圆角。 |
| 88 | `auto_awesome` | F0／`tertiary-container` → `#647700`／22 | `.list-icon.lime` 字符 `✧`；源40px盒、`vibrant-lime-tint #F3FEE7`。 |
| 98、113、128，3枚 | `arrow_forward_ios` | F0／`outline` → `#737687`／20 | `.action-list .list-arrow` 字符 `›`；应三处同名官方SVG，不能换成 `chevron_right`。 |
| 106 | `diversity_1` | F0／`electric-blue` → `#1D64F2`／22 | `.list-icon.blue` 字符 `♧`；源40px盒、`electric-blue-soft #EBF2FE`。 |
| 121 | `code` | F0／`party-violet` → `#5856D6`／22 | `.list-icon.violet` 字符 `⌘`；源40px盒、`party-violet-soft #F2F1FD`。 |
| 149 | `chat` | F0／`status-active-green` → `#34C759`／20 | `.network-icon.green` 字符 `▤`；源36px圆、green 10%底。仍标“待公布”，不建立官方账号。 |
| 157 | `photo_camera` | F0／`party-pink` → `#FF2D55`／20 | `.network-icon.pink` 字符 `▧`；源36px圆、pink 10%底。仍标“待公布”。 |
| 165 | `forum` | F0／`tertiary-container` → `#647700`／20 | `.network-icon.lime` 字符 `▣`；源36px圆、`#F3FEE7`底。仍标“待公布”。 |
| 174 | `public` | F0／`on-surface-variant` → `#424655`／18 | 原官方网站行；当前 `.repository-link` 是“公开工程与依赖说明”跳开源页，首字符 `⌘`。源官网事实不能移入该行；若复用此行装饰须记录真实工程入口适配，不把另一枚 `code` 称为原 `public`。 |
| 179 | `open_in_new` | F0／`electric-blue` → `#1D64F2`／16 | 原官网链接末图；当前 `.repository-link text:last-child` 为“查看 ↗”。当前是小程序内部导航，不能通过图形恢复 `projectirl.app` 外链。 |
| 187 | `star` | F0／`party-pink` → `#FF2D55`／18 | 原评分按钮；当前 `.about-actions button:first-child` 为“浏览活动灵感”且 `✧`。**无源评分功能目标**；保留真实发现入口，不声称当前 `auto_awesome` 近义图即原星图。 |
| 191 | `group_add` | F0／`on-primary` → `#ffffff`／18 | 原共创群按钮；当前 `.about-actions button:last-child` 为“发起受控活动”且 `♧`。**无共创群目标**；保留真实发起入口，不添加群入口。 |
| 215，动态 | `refresh` | F0／`status-active-green` → `#34C759`／14 | 原脚本600ms假检查中状态；当前无对应更新API/handler。只记录，不移植计时器。 |
| 217，动态 | `done_all` | F0／`status-active-green` → `#34C759`／14 | 原脚本“已是最新v1.2.0”；当前无对应证据。只记录。 |

**最高优先级身份差距**：当前 `.logo` 的 `∞`、`.logo-crown` 的 `♢`、单色边框是自行拼形；原稿明确提供专用“Custom Infinity Spark SVG Logo”，不是可用任意无穷符号代替的 Material 图标。原稿 `code.html:22–39` 的完整标识如下（保留导出 HTML 原始大小写）：

```html
<svg class="w-14 h-14 relative z-10 text-electric-blue" fill="none" viewbox="0 0 64 64">
<defs>
<lineargradient gradientunits="userSpaceOnUse" id="irlGradient" x1="8" x2="56" y1="20" y2="44">
<stop offset="0%" stop-color="#1D64F2"></stop>
<stop offset="60%" stop-color="#5856D6"></stop>
<stop offset="100%" stop-color="#34C759"></stop>
</lineargradient>
<filter height="140%" id="sparkGlow" width="140%" x="-20%" y="-20%">
<fegaussianblur result="blur" stddeviation="2"></fegaussianblur>
<fecomposite in="SourceGraphic" in2="blur" operator="over"></fecomposite>
</filter>
</defs>
<!-- Stylized Mobius / Infinity loop representing IRL connections -->
<path d="M20 22C14 22 10 26.5 10 32C10 37.5 14 42 20 42C26.5 42 30 36 32 32C34 28 37.5 22 44 22C50 22 54 26.5 54 32C54 37.5 50 42 44 42C37.5 42 34 36 32 32C30 28 26.5 22 20 22Z" stroke="url(#irlGradient)" stroke-linecap="round" stroke-linejoin="round" stroke-width="5.5"></path>
<!-- Badminton / Spark Joy Asterisk in Vibrant Lime -->
<circle cx="32" cy="18" fill="#D2F803" r="3.5" stroke="#1D64F2" stroke-width="1.5"></circle>
<path d="M32 10V14M26 12L28.5 15M38 12L35.5 15" stroke="#1D64F2" stroke-linecap="round" stroke-width="2"></path>
</svg>
```

本地独立SVG文件需为XML恢复 `viewBox`／`linearGradient`／`gradientUnits`／`feGaussianBlur`／`stdDeviation`／`feComposite` 的标准大小写并补SVG命名空间；这是语法规范化，**Mobius path、spark path、circle、坐标、线宽和三个颜色不应改画**。原 `sparkGlow` 定义没有被路径引用，不要自行添加过滤器改变外观。原容器96×96px、外圆角26px、2px渐变边，内圆角24px，SVG **56×56px**；当前盒74×74px、圆角21px、SVG不存在，偏小22.9%。原右上绿点8px、top/right8px、绿色glow；当前7.5px点、right7px/top5px。原英雄还有192px蓝10%模糊光晕和128px青柠20%模糊光晕，可用同页CSS恢复，不能重生成Logo位图。

| H几何／字级 | 原HTML明确值 | 当前（375px换算） | 局部建议 |
|---|---|---|---|
| 页面左右边距 | 16px | 13px | `.about-page` 32rpx；头部负边距同步。 |
| 品牌名 | 28px／36px800，顶部12px | 22px800，logo底24rpx=12px | `.title` 56rpx／72rpx，保留真实名。 |
| 宣言卡／引文／正文 | p16px、radius16px；17px／22px600、13px／18px | p14×12px、radius14px；13.5px800、10px | `.manifesto-card` 32rpxpadding/radius；正文26rpx／36rpx，引文34rpx／44rpx；图文gap8px。 |
| 导航图盒／主字／次字 | 40px方盒、radius12px；17px／22px600、13px／18px | 26px盒、radius8.5px；11.5px700、9px | 原图盒80rpx、glyph44rpx；主34/44rpx，次26/36rpx。 |
| 列表单行padding／图文gap／分割线 | p16px、gap12px、divider左缩56px | py11px、gap7.5px，父左右11px、分割线从行左起 | 局部恢复32rpx padding、24rpxgap和112rpx左缩分割线；真实长字可换行。 |
| 网络卡／渠道圆／字级 | p16px、gap12px；36px圆、13px标题、13px副字 | p11.5px；24px圆、9px标题、8px副字 | 仅恢复盒/文本几何；“待公布”与灰色未公布点维持真实状态。 |
| 底部双按钮 | py12px，radius12px，13px／16px600 | py4px、radius10.5px、10px，line-height21px | 按原尺寸恢复真实发现/发起按钮；属于目的地适配，不新增评分或群服务。 |

原版本 `1.2.0 / Build 2024.0322`、`@ProjectIRL`、`projectirl.app`、绿色在线点、线下局周报/聚会灵感精选/创作者空间、虚构公司、2024版权和备案/经营许可证号均无R1可信数据源。当前“本地测试候选／待公布／主体与发布信息待核实”文案应保留。源宣言的理念可排版恢复，不能据其说明自动订场、AI或已完成实际运营。

## H1：当前功能与版本说明

| HTML行 | 精确原名 | FILL／源色 token → 色值／显示px | 当前目标 selector／处理边界 |
|---|---|---|---|
| 19 | `verified` | F1／`status-active-green` → `#34C759`／14 | `.release-status text:last-child` 当前 `◉ 当前工程能力`；源“最新正式版”无事实，不恢复认证章。 |
| 31 | `event` | F0／`on-surface-variant` → `#424655`／15 | `.release-intro-note` 原为发布日期行；当前说明版本/日期待确认。**无真实日期slot**，不增加2024更新日。 |
| 38 | `auto_awesome` | F0／`on-primary` → `#ffffff`／18 | `.intro-highlight` 当前 `✦`；源32px蓝紫渐变圆，图形18px；可恢复真实流程说明旁的非交互装饰。 |
| 54 | `mic` | F0／`on-primary` → `#ffffff`／24 | 第1 `.feature-icon.blue` 当前 `♢`；源40px electric-blue实体盒、glyph24px。当前标题是草稿能力，恢复原图形时仍明确未开放真实AI语音。 |
| 77 | `graphic_eq` | F0／`primary` → `#004cc8`／18 | 第1能力卡第1 `.feature-point` 当前 `✧ 字段建议与核实`。原图形可准确记录/恢复，不能恢复“按住说话自动提取”功能文案。 |
| 86 | `stylus_note` | F0／`party-violet` → `#5856D6`／18 | 原第1卡第2子项“文案海报生成”；当前第2项是“人工审核发布”且 `✓`，**不是同义功能slot**。不要把另一枚check称为源stylus_note，不恢复自动生成。 |
| 95 | `partly_cloudy_day` | F0／`tertiary` → `#4d5d00`／18 | 原地点/天气预判第三子项；当前缺此项，**不新增天气或自动场馆排期**。 |
| 110 | `receipt_long` | F0／`on-primary` → `#ffffff`／24 | 第2 `.feature-icon.violet` 当前 `▤`；源40px party-violet实体盒。当前真实标题“邀请、报名与协作”不同于源AA章节；应记录内容适配。 |
| 124 | `check_circle` | F0／`status-active-green` → `#34C759`／14 | 原第2示意图上的“6人分摊已就绪”；当前 `.feature-image text` 只称示意配图，**不恢复6人状态**。 |
| 131 | `document_scanner` | F0／`primary` → `#004cc8`／18 | 原票据识别子项；当前“候补与协办”且 `♧`，**无OCR slot**，不能以相近图替代并宣称源功能。 |
| 140 | `swap_horiz` | F0／`status-active-green` → `#34C759`／18 | 原支付状态流子项；当前“站内状态通知”且 `◉`，**无支付slot**，不恢复结清功能。 |
| 155 | `military_tech` | F0／`on-primary` → `#ffffff`／24 | 第3 `.feature-icon.pink` 当前 `♜`；源40px party-pink实体盒；保留“签到、AA与安全”实际标题，不表示授勋。 |
| 169 | `shield` | F1／`status-active-green` → `#34C759`／20 | `.feature-triplet > view:nth-child(1)` 当前 `✓ 动态口令签到`；源36px浅绿圆、填充盾；不能恢复“靠谱局长99%”。 |
| 176 | `bolt` | F1／`electric-blue` → `#1D64F2`／20 | `.feature-triplet > view:nth-child(2)` 当前 `ϟ 费用分摊标记`；源36px浅蓝圆；不能恢复“秒速成局/30分钟”。 |
| 183 | `favorite` | F1／`party-pink` → `#FF2D55`／20 | `.feature-triplet > view:nth-child(3)` 当前 `♡ 举报申诉入口`；源36px浅粉圆；不能恢复“神仙搭子/履约100%”。 |
| 192 | `verified_user` | F0／`party-pink` → `#FF2D55`／18 | 原信用勋章子项；当前第3卡仅有 `◉ 边界清晰`，**无信用授予slot**。 |
| 201 | `photo_library` | F0／`party-violet` → `#5856D6`／18 | 原同框相册子项；当前只在后续方向明确未开放，**不新增相册**。 |
| 214 | `build_circle` | F0／`primary` → `#004cc8`／20 | 第4 `.feature-icon.blue` 当前 `◷`，源不是schedule，且源为独立20px无40px色块；改源图形须同时去掉额外方盒。 |
| 242 | `favorite` | F0／`primary` → `#004cc8`／24 | 原感谢块48px白圆；当前 `.release-foot` 仅真实感谢句。可恢复一般感谢卡装饰，无新增功能。 |
| 248 | `check_circle` | F1／`status-active-green` → `#34C759`／20 | 原最终“当前已是最新版本(v1.2.0)”；当前缺此块，**不新增最新版本结论**。 |

原第1/第2卡照片是两份独立 HTML 指定的 `lh3.googleusercontent.com/aida-public/...` 背景URL，位置分别 H1:66、H1:122；当前分别复用 `/assets/stitch/caper_discover_coffee.jpg`／`caper_discover_boardgame.jpg`，**不是两份原始图**。本次没有请求或下载远程媒体。若要进一步恢复图片，沿原 URL 的既有资产保存流程留 source/hash，标“活动场景示意配图”，不要把原例子“今晚8点静安匹克球、6人分摊就绪”当真实数据。

| H1几何／字级 | 原HTML | 当前375px | 局部恢复目标 |
|---|---|---|---|
| 页左右／卡padding/radius/间隔 | 16px／16px/16px／12px（首卡另顶部16px） | 9px／10px/11.5px／6.5px | 32rpx左右、32rpx卡padding/radius、24rpx卡间隔。 |
| intro标题／正文 | 22px／28px700；13px／18px | 16px800；9px／13.5px | 44/56rpx、26/36rpx。当前真实版本说明可自然增高。 |
| feature主图 | 高144px、radius12px | 高82.5px、radius7px | 288rpx高、24rpx圆角；原图取源另行留证据。 |
| feature图盒／字 | 40px实体色盒、radius12px；24px白图 | 22px浅色盒、radius7px；13px字体 | 80rpx盒、24rpx圆角、48rpx原SVG；切源实体色/白图，三个分区颜色独立。 |
| feature主标题／小标题／正文 | 17px／22px600、13px／16px600、13px／18px | 12px750、9px700、8.5px400 | 34/44rpx、26/32rpx、26/36rpx；英文/中文实际字数可增加高度。 |
| 子项块／triplet | p12px、radius12px、gap10px；36px圆图盒 | p6px、radius7.5px、gap5px；当前只有文字形 | 24rpxpadding/radius、20rpxgap；三项保持真实签到/分摊记录/举报说明。 |

源所有 `v1.2.0 Official Release`、Copilot正式协同上线、语音、多模态、天气、OCR、支付、信用惩戒、相册、私聊/发现优化及离线能力宣称都不能随几何复制。当前实际的草稿→审核→邀请报名→签到/费用记录/安全流程和“后续方向”是R1内容，保留现 `goCreate`／`goActivities`。原页是说明终端，新增真实操作按钮已是现有产品适配，不能为追求长图高度把它们换成假更新检测。

## H2：社区引导

| HTML行 | 精确原名 | FILL／源色 token → 色值／显示px | 当前目标 selector／边界 |
|---|---|---|---|
| 20 | `handshake` | F1／`on-primary` → `#ffffff`／32 | `.charter-mark` 当前 `♡`；源64px蓝紫圆、32px填充握手。不能换F0握手轮廓。 |
| 23 | `favorite` | F1／`on-primary` → `#ffffff`／15 | `.charter-mark > view` 当前 `✓`；源28px party-pink圆，right/bottom -4px。 |
| 58 | `schedule` | F0／`primary` → `#004cc8`／22 | 第1 `.guideline-head .pg10-icon` 当前 `◷`；源40px浅蓝盒。 |
| 72 | `event_busy` | F0／`primary` → `#004cc8`／14 | 第1 `.guideline-body > view:nth-child(1) > text` 当前 `▣`；源20px blue10%圆。 |
| 84 | `gavel` | F0／`party-pink` → `#FF2D55`／14 | 第1正文第2行 `⌁`；原“违约信用惩戒”，当前“重要变更再确认”。不是同一惩戒功能；不能恢复信用分/14天禁报。 |
| 100 | `diversity_3` | F0／`party-violet` → `#5856D6`／22 | 第2 `.pg10-icon.violet` 当前 `♧`；源40px浅紫盒。 |
| 114 | `hearing` | F0／`party-violet` → `#5856D6`／14 | 第2正文第1行 `♧`；源20px浅紫圆，**不是diversity_3复用**。 |
| 126 | `block` | F0／`error` → `#ba1a1a`／14 | 第2正文第2行 `⊘`；源20px `error-container #ffdad6`圆，当前图统一pink；恢复error色，不增加自动永久封禁承诺。 |
| 142 | `receipt_long` | F0／`status-active-green` → `#34C759`／22 | 第3 `.pg10-icon.green` 当前 `▤`；源40px浅绿盒。 |
| 156 | `visibility` | F0／`status-active-green` → `#34C759`／14 | 第3正文第1行 `◎`，当前继承blue；源20px浅绿圆。 |
| 168 | `bolt` | F0／`status-active-green` → `#34C759`／14 | 第3正文第2行 `ϟ`，当前被全局nth-child规则染pink；源浅绿圆/green图，保持“双方标记仅作记录”。 |
| 183 | `photo_camera_front` | F0／`tertiary` → `#4d5d00`／22 | 第4 `.pg10-icon.lime` 当前 `▧`；源40px浅青柠盒，不换photo_camera。 |
| 192 | `check_circle` | F0／`primary` → `#004cc8`／18 | 第4正文第1行 `✓`；源直接18px图，无20px圆盒。 |
| 198 | `privacy_tip` | F0／`primary` → `#004cc8`／18 | 第4正文第2行 `♢`，当前nth-child规则染pink；源primary蓝，原“撤回/模糊面部”未开放，保持实际举报/屏蔽/数据请求说明。 |
| 208 | `format_quote` | F0／`party-violet` → `#5856D6`、opacity0.4／28 | `.guideline-quote` 当前只有文字引号，无左侧28px引号。可补准确源装饰。 |
| 222 | `check` | F1／`on-primary` → `#ffffff`／16 | 原承诺生效胶囊24px绿圆；当前是 `goReport` 真实举报求助按钮。**不新增已阅读/已承诺/生效中**，不假写承诺状态。 |
| 235 | `shield` | F0／`on-surface-variant` → `#424655`／14，父opacity0.6 | 原底部“真实身份认证/防诈已开启”；当前正式引导待审说明，无核验状态，**不恢复已开启保证**。 |

| H2几何／字级 | 原HTML | 当前375px | 局部恢复目标 |
|---|---|---|---|
| 页左右／卡padding/radius/间隔 | 16px／16px/16px／16px | 9px／10px/12px／7.5px | 页32rpx、卡32rpxpadding/radius、32rpx间隔；首卡上方12px。 |
| 主握手／小心圆 | 64px圆、32px图；28px圆、15px图 | 38.5px圆/24px心字符；15px圆/8.5px勾 | 128rpx/64rpx握手、56rpx/30rpx心；原offset -8rpx。 |
| hero主标题／说明／价值词/副字 | 22px／28px700；15px／21px；15px/11px | 15px800；10px；11px/7.5px | 44/56rpx、30/42rpx、30rpx/22rpx。保留“守时/友善/透明”，不恢复100%出席或0骚扰统计。 |
| 原则盒／标题／英文 | 40px盒、22px图；17px／22px600；11px／14px | 21.5px盒、13.5px文字；11px750；7.5px | 80rpx盒、44rpx图、34/44rpx标题、22/28rpx英文。 |
| 正文块／行图／正文 | p12px、radius12px；20px圆中14px图；13px／18px | p3.5×8.5px、radius8.5px；11px字符无圆；9px／13.95px | 24rpxpadding/radius；40rpx圆/28rpx图，第四原则图36rpx独立；正文26/36rpx。 |

原承诺、正式委员会署名、4小时取消、14天限制、永久封禁、24小时结清、真实身份认证、防诈骗已开启及面部模糊能力不是当前可承诺的产品数据。现 JS `goReport()` 会写当前身份所属举报上下文再去我的页面；所有身份/会话绑定必须保持，不能为做“已读绿色胶囊”删掉或改写实际求助流程。

## H3：实际工程依赖与致谢

| HTML行 | 精确原名 | FILL／源色 token → 色值／显示px | 当前目标 selector／边界 |
|---|---|---|---|
| 15 | `code` | F0／`primary` → `#004cc8`／26 | `.source-icon` 当前 `⌘`、24px盒/15px字；源48px盒、radius12px、26px图。 |
| 30 | `terminal` | F0／`primary` → `#004cc8`／18 | 第一 `.source-section` 现 `▣`；源不能换成code或普通框。 |
| 105 | `favorite` | F0／`party-pink` → `#FF2D55`／18 | 第二 `.source-section` 现 `♡`；源在 `.thanks-card` 标题旁32px浅粉方盒、radius8px，有15px标题与11px英文副字。可恢复同一“致谢”主题。 |
| 116 | `celebration` | F0／`party-violet` → `#5856D6`／18 | 原 Partiful致谢子项；当前 `.thanks-row:nth-child(1)` 是测试协作者句，缺独立标题/图。**不是已确认Partiful合作对象**，不复制原署名当实际贡献者。 |
| 126 | `touch_app` | F0／`primary` → `#004cc8`／18 | 原 Apple HIG致谢子项；当前第2句是 supplied Stitch包设计来源，无同一署名slot。仅记录源符号。 |
| 136 | `diversity_3` | F0／`status-active-green` → `#34C759`／18 | 原上海球友群体致谢；当前第3句是仓库/名单待发布，不声称实际上海用户来源。仅记录源符号。 |
| 148 | `gavel` | F0／`on-surface-variant` → `#424655`／16 | 第三 `.source-section` 现 `⌁ 许可说明`，可准确恢复图形，保持当前摘要声明，不填入原通用MIT正文。 |

| H3几何／字级 | 原HTML | 当前375px | 局部恢复目标 |
|---|---|---|---|
| 页左右／intro卡padding/radius | 16px／16px/12px | 9px／8.5px/10px | 页32rpx、intro32rpxpadding/24rpxradius；首卡上方12px。 |
| intro标题／副字／正文 | 17px／22px600；11px／14px700；13px／18px | 11.5px750、7.5px、9px | 34/44rpx、22/28rpx、26/36rpx。 |
| section／计数badge | 15px／20px600；11px／14px700 | 9.5px、8px | 30/40rpx、22/28rpx；源section左4px内部/计数pillpadding8×2px。 |
| dependency卡padding/radius/gap | 12px/12px/8px | 8.5px/10px/4.5px | 24rpxpadding/radius、16rpxgap。 |
| 依赖名／作者／正文／badge | 17px／22px600；13px／18px；13px／18px；11px／14px | 11px750；8.5px；9px；8px | 34/44rpx、26/36rpx、26/36rpx、22/28rpx；长真实依赖名自然换行。 |
| 致谢外卡／内卡 | p16px、gap12px；p12px、radius8px | 外p8px；内p7px、radius7.5px、gap4.5px | 保留三个真实陈述，按外32rpx/内24rpx、16rpxradius、24rpxgap恢复；新增任何署名须真实来源。 |
| 许可底块 | `surface-container-highest #e3e2e7`、p12px/radius12px；源11pxmono完整通用MIT | `#e8e8ed`、p9px/radius9.5px；当前9px实际摘要 | 可恢复容器/摘要字号与色，**不能用虚构全工程MIT声明填满源长图高度**。 |

`package.json` 与已安装包直接证明当前使用的五项是 `pg`、`@electric-sql/pglite`、`typescript`、`tsx`、`qrcode-generator`，不是原稿的 Tailwind UI、Lucide、Plus Jakarta Sans、Canvas Confetti、date-fns 五项。当前页五个许可简写与本机 package metadata 一致（MIT／Apache-2.0），仍只是摘要，不替代各包原始许可文件及发布归属核验。

另外发现一处**真实署名数据差距**：当前 pg作者写 `The PostgreSQL Global Development Group`，已安装 `pg@8.23.0` 的 `node_modules/pg/package.json` 给出的作者是 `Brian Carlson`、主页 `https://github.com/brianc/node-postgres`。恢复UI可顺手改为包的实际署名，避免把数据库项目与JavaScript客户端作者混为一谈。其余metadata：PGlite0.5.8作者 `Electric DB Limited`；TypeScript7.0.2作者 `Microsoft Corp.`；tsx4.23.15作者 `Hiroki Osame`；qrcode-generator2.0.4作者 `Kazuhiko Arase`。当前tsx/qrcode描述是用途，不声称作者，若补作者使用这些已读元数据，不用原示例署名。

原“Copyright(c)2024 Project IRL Contributors”、统一MIT全文、`All components verified` 绿色状态与上海参与者都不能被源几何恢复自动采纳。当前真实仓库 `https://github.com/tony132321/miniprogram` 及 `copyRepository()` 是已存在行为，保留成功/失败反馈，不恢复未核验许可证或“全组件已验证”保证。

## 最小可实施批次与资源来源

1. **先做H原身份**：把原Infinity Spark SVG保存为本页本地资产，保留原paths/渐变；替换Unicode Logo/皇冠，恢复96px盒/56pxSVG。恢复H头部3枚、宣言favorite/format_quote、三行精确入口图和3枚arrow_forward_ios、3枚渠道图；渠道继续“待公布”。这是明确且无业务接口变化的最小品牌/主要图形批次。
2. **同批可并行按页面恢复H1/H2/H3现有可对齐的图形与明显尺寸**：三页各自4枚header；H2握手+心、四原则、可对应真实原则的正文图、引号；H3 code/terminal/favorite/gavel；H1现有章节与三项示意图只有装饰可恢复，不把缺失功能slot补成原示例功能。表中明确“无slot／只记录／不恢复状态”的项不进入资源数量或完成宣称。当前改过主题的子项应单独列为内容适配，不能以“换一枚语义相近图标”满足原图复核。
3. **仅页内WXML/WXSS与页内assets**：不改 `common.wxss`／`navigation.js`，无新API、定时器、承诺持久化或外部账号；现导航/share/求助/复制JS保持。H在主包，资产建议 `miniprogram/assets/stitch/pg10h/`；三个说明页各放本页 `assets/`，不要让主包H引用个人分包独占文件。所用SVG全部明确 `aspectFit` 与px对应rpx宽高，移除替换后的CSS框/字符，避免继承背景和伪元素残留。
4. **资源管线**：首选已核定 `/private/tmp/irl-material-symbols-wave60/export_symbol.py`，提交 `bd8cb85bd4bad964fe6918f79665bb40c3a8efef` 的 `symbols/web/<exact-name>/materialsymbolsoutlined/<exact-name>[_fill1]_24px.svg`。只改SVG根fill；path不改。各目录manifest记录原名/FILL/颜色/sourceURL/源与资源SHA-256，授权复用 `docs/licenses/material-symbols-Apache-2.0.txt`。不预先宣称本批名字都取得成功。
5. **固定源没有精确原名时**：用 `/private/tmp/irl-material-symbols-wave60/export_font_symbol.py` 精确原连字提取官方静态字体；保留CSS/字体字节、GSUB映射、字体版本/轴与hash证明，独立记录字体来源，不能算成上述固定SVG commit，也不能替换成另一个同义名字。该helper目前限定个人分包asset路径，H主包若遇此情况由根代理审查后调整本次临时helper的允许目标，不能把导出结果藏到跨包路径。
6. **审阅与上传节奏**：每个完成的页面代码批次先独立核本地引用、SVG/XML、manifest散列、原path/FILL/token；再只做本批必要的定向编译/按钮实点与375px胶囊布局核对，确认真实关闭态和JS未漂移；根代理按已授权节奏上传GitHub。没有必要为这些可逆视觉调整新增镜像测试或跑全量。所有模拟器、真机、原生分享送达、远程素材与逐像素差异均分别报告，不能用本审计替代。

本批最突出的源码差距是：原Logo未保留、75个静态源符号被大量字符/CSS或缺项替代、四页头部低10px、后三页9px边距及正文/卡片/图盒普遍压缩。可先恢复真实内容的原图形和明确几何；原演示稿的版本、服务能力、在线、承诺、账号、法律和统计数据不构成R1事实。
