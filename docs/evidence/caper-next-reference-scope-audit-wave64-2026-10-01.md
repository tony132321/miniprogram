# Wave 64 下一批原稿复刻范围：三个核心 Tab

日期：2026-10-01。性质：只读原稿／当前源码差距盘点。本次只新增本文件，没有修改小程序、业务、公共资产或总验收矩阵，没有运行测试、微信工具或发布代码。本文件不是新视觉通过证据。

## 选择及证据范围

建议三个独立实现者并行处理 **首页 `caper_2`、发现 `caper_4`、我的 `caper_1`**。三者都是用户直接检查的核心入口，当前仍有明确的原稿字级、尺寸及图形差距，页面目录互不重叠。Wave 59–62 已完成的 PG10 子页和 Wave 63 城市／行程／邀请卡不在本批范围。

当前注册 20 条路由承载 ZIP 的 39 个屏／状态，不能按路由数量估算完成率。已读 `docs/stitch-ui-parity.md` 的 E11／E24／E37／E104 及三个核心页行，和 `docs/acceptance-matrix.md` 的最新验证边界；既有页面结构、绑定和过去局部实点可复用，尚未构成这三个屏的一比一结论。本批优先补三个核心入口的首屏和可重复的视觉组件，长页未盘点部分不据此自动通过。

原稿根目录：`/private/tmp/irl-stitch-original/stitch_design_system_generator/`。三个 `code.html`／`screen.png` 均逐字节核对用户 ZIP，结果完全一致；ZIP 内 `code.html` 数量为 39。本次直接查看三张原 PNG，并阅读下表指定 HTML 与当前 WXML／WXSS／JS。

| 原稿目录 | HTML SHA-256 | PNG SHA-256 | PNG 像素 |
| --- | --- | --- | --- |
| `caper_2/` | `e4e4ba417711e27838f10cef098c4da8c428d3b9d7c4217fe36d9def5761c4ca` | `81028ecae6d89d2b77c70750e628c1e58a355dd52704e2a3646dcf392934f13f` | 177 × 1600 |
| `caper_4/` | `514d9e5fbfbbc66e9c5c19cf33767b58b54f77a144720c4b89f3b5248356aed2` | `15ffd670e926b6f508dac5223bb00e3beee8301a6a712a3836d468893a95d63e` | 176 × 1600 |
| `caper_1/` | `37088f60630a26b0c2711c9ef018076d3ede9128cf33e5b7bf399fb66217faf9` | `8901eb5958e4ecb9a209d40992c0214e5e6b1d89b99a64b5eabea22df6bbb369` | 212 × 1600 |

**尺寸口径：** PNG 是缩小的整页长图，不能把 PNG 的 177／176／212 px 当作原稿设备宽度。`caper_1` HTML 固定 `main w-[390px]`，`caper_4` 声明 viewport 390／max-width 390，`caper_2` 是 `w-full max-w-[440px]`。下表记录 HTML 的真实 CSS px 和当前 WXSS 的 rpx；括号中的当前 px 仅按 375 px 窗口换算，属于源码单位比较，不是运行测量。实现需声明采用的逻辑宽度：例如保留 CSS px，或固定 390 基准时按 `750 / 390` 换算 rpx。不能混用固定 390 基准和默认 `1 px = 2 rpx` 后声称同尺寸。微信真实状态栏、胶囊及手势安全区必须作为明确适配单独测量。

## A：首页首屏 `caper_2`

承载：`miniprogram/pages/index/index.{wxml,wxss,js}`。原稿首屏核对范围 `code.html:89–257`；对应当前 `.home-header`、`.caper-top`、`.hero`、`.category-strip`、`.feature-card`。原 PNG 可看到大圆角渐变 Hero、六个等距分类、羽毛球大封面及完整事实白卡，当前源码保留模块顺序，但尺寸被不同程度缩小。

| 位置与原 HTML 行 | 原稿明确值 | 当前源码值及差距 |
| --- | --- | --- |
| 品牌／城市，94–105 | Logo 28 × 28、圆角 12；中文 16；英文 9；城市文字 12／左右 padding 10；下箭头是给定 SVG path | WXSS:9–13：Logo 42 rpx（21）、圆角 12 rpx（6），中文 27 rpx（13.5），英文 15 rpx（7.5），城市字体 20 rpx（10）；箭头是 `⌄`，不能算原 SVG |
| 铃铛，110–112 | 按钮 32、glyph 16，原 HTML 提供 stroke=2 的完整 SVG；红点只作为视觉形状 | 当前按钮 48 rpx（24），glyph 是 `.header-bell` CSS 边框／伪元素近似；应提取原 SVG，保留真实未读判断 |
| Hero 外壳，122–125 | 外侧水平 16；内 padding 20；圆角 **28 px**；渐变 `#d4f84c → #b6f041 → #3b82f6`；贴纸 rotate 12°、圆角 16、top 8/right -12 | 当前 `.home-main` 水平 28 rpx（14），Hero padding 25/24/22 rpx、圆角 **28 rpx（14）**；四站渐变及 118°方向不同；贴纸 rotate 10°、全圆角、偏移不同 |
| Hero 字级，130–134 | 手写 kicker 18／Caveat；标题 24／900；副文 12，标题上距 4、下距 2 | 当前 kicker 17 rpx（8.5）、无手写 font-family；标题 39 rpx（19.5）；副文 23 rpx（11.5）；标题上距 11 rpx（5.5） |
| 输入与提交，136–140 | 圆形提交按钮 32，箭头原 SVG glyph 16／rotate 45°；输入文字 12；左图形原 microphone SVG 16 | 当前按钮 43 rpx（21.5）、文字 `➜`；输入 20 rpx（10）；左图形是 `✦`。语音未接入，原 microphone 应为明确关闭的语音入口或纯说明图形，不能暗示已能录音 |
| 六分类，148–191 | 容器 justify-between；各图形盒 **48 × 48**／圆角 16；emoji 20；标签 11、距 6；原稿用 🏸／🥘／🍸／🏙️／🎲／••• | 当前横向 width:max-content、gap 23 rpx；盒 **69 × 69 rpx（34.5）**／圆角 25 rpx（12.5）；emoji 34 rpx（17）；标签 18 rpx（9）。六项首屏分布及尺寸需恢复；不能因运动分类能创建而把其他类别改成真实可发布 |
| 主封面，198–220 | 卡圆角 24；封面 **224 px**；overlay bottom 80%／middle 30%／top 20%；标题 24／手写副标 14；顶部 glyph 14、圆按钮 24 | 当前卡圆角 27 rpx（13.5），封面 **380 rpx（190）**；gradient 当前 top28%／middle10%／bottom65%；poster 42 rpx（21），副标 22 rpx（11），箭头 `›` |
| 主卡事实区，224–253 | padding 16；标题 16；状态 11；时间／场地 12、原 calendar／pin SVG 14；人物仅为原稿示例 | 当前 padding 21/22/17 rpx、标题 28 rpx（14）、状态 18 rpx（9）、事实 20 rpx（10）；`▣`／`⌖` 代替原 SVG。真实人数和来源说明必须保留；不补假人物照片或“16 人已报名” |

真实业务：`GET /me/events` 与同场授权详情核事实／人数，未读铃铛取当前会话；`goCity`→城市，`goMessages`→消息，`goProfile`→我的；Hero 预填→当前身份一次性 IDEA，保留已有草稿保护；羽毛球类别→发起，其他类别→能力说明，真实主卡→同 ID 详情，空态主卡→发起。

本页全部状态共用同一个 WXML／WXSS。实现者只改 `!stateView` 首屏标记和对应样式；新增选择器需限定 `.caper-top`／普通首页，不能让首屏字号／封面高度覆盖 PG02-B/C/D／草稿箱卡片。JS 的读取、时间、当前身份、邀请、操作保护不在此任务修改范围。原稿全页有 22 个 inline SVG，但其中含底部导航；优先提取本首屏原 path／stroke，并保留源文件与行号／hash，不换成近似 Material 图形。Caveat／Permanent Marker 在 HTML 有原始 Google Fonts 引用，是否可原生加载、字体文件授权／大小及实际渲染需另有证据，本审计没有下载或验证字体。

## B：发现首屏 `caper_4`

承载：`miniprogram/pages/discover/discover.{wxml,wxss,js}`。原稿核对 `code.html:37–38,89–270`，对应顶栏、分类和四张主卡。原 PNG 可看到圆形“耍”Logo、较大的同排品牌、搜索／漏斗及四张照片卡；当前四卡结构和图片存在，字级／盒尺寸和图形仍有差距。

| 位置与原 HTML 行 | 原稿明确值 | 当前源码值及差距 |
| --- | --- | --- |
| 品牌，94–100 | 圆 Logo 32；中文 20、英文 12；logo 与文字 gap 8 | 当前 Logo 34 rpx（17）、中文 26 rpx（13）、英文 16 rpx（8）、gap 7 rpx（3.5） |
| 中间标题／动作，105–115 | 标题 16，副标题 10／上距 2；搜索和漏斗按钮 32，glyph 18，动作 gap 12 | 当前标题 24 rpx（12）、副标题 14 rpx（7）；动作 34 × 36 rpx（17 × 18）、gap 2 rpx（1）；WXML `⌕`／`☷` 不是原搜索／漏斗 |
| 分类，129–140 | font 12；全部 padding 6 × 16，其他 6 × 14；gap 8；顶部 padding 12、底 10；bg 白95%／backdrop blur-md | 当前 font20 rpx（10）、padding8 × 20 rpx（4 × 10）、gap8 rpx（4），top15 rpx（7.5）／bottom12 rpx（6），白100%／无 blur |
| 四主卡，144–149 | 横向 inset 12、gap12；卡圆角16；照片高176；body padding10 | 当前 inset24 rpx（12）和gap24 rpx（12）已接近原逻辑值；照片350 rpx（175）也接近。**不要为改动量而重做已经接近的几何。** 卡圆角20 rpx（10）、body17/17/15 rpx（8.5/8.5/7.5）仍需修 |
| 主卡字级，151–160 | 标题14、副文11、事实10；时间 calendar-blank／场地 map-pin 是源 Phosphor regular | 当前标题27 rpx（13.5）、副文20 rpx（10）、事实18 rpx（9）；WXML `▣`／`⌖` 替代源 glyph |
| 收藏／贴纸，148／180等 | 收藏圆28、heart bold14；位置 top/right10；CITY/WALK20、TOGETHER12；basketball kick12/主文18 | 当前收藏43 rpx（21.5）、`♡`；位置13 rpx（6.5）；CITY39 rpx（19.5）/副标21 rpx（10.5）；basketball主文35 rpx（17.5）。字形、盒尺寸、间距需复核，收藏行为仍关闭 |

**图形源不是 Material Symbols。** HTML:37–38 固定 `@phosphor-icons/web@2.0.3`；HTML 中没有 inline SVG。全页 26 个不同 Phosphor 名称（含模拟状态栏和公共底栏，不能都计入页面实现量）：`arrow-right`、`arrows-clockwise`、`barbell`、`battery-full`、`buildings`、`calendar-blank`、`camera`、`caret-right`、`cellular-signal-full`、`chat-circle-dots`、`chat-teardrop-dots`、`compass`、`fork-knife`、`funnel-simple`、`game-controller`、`heart`、`house`、`magnifying-glass`、`map-pin`、`moon-stars`、`navigation-arrow`、`plus`、`sparkle`、`user`、`users-three`、`wifi-high`。首屏需按每个原节点的 `ph`／`ph-bold`／`ph-fill` 及颜色提取**同版本同字形**；不能用名称相似的 Material 图标替代。系统状态栏由微信提供，公共 Tab Bar 留给 root 统一处理。

真实业务：四主卡是静态灵感，不是公开场次；搜索／筛选／收藏显示未开放，保留动作；“全部”清除能力提示，“附近”滚到真实附近状态并可选城市；灵感卡支持当前类别说明和发起确认；本人活动经 `/me/events` 的授权摘要进入同 ID 详情；邀请输入／预览／扫码有当前身份和旧回调保护。`public_discovery=false`、`open_matching=false`，不得补入参考稿日期、真实地点、评价、好友报名量或假主理人。

顶栏缩放以后，需要单独验证三部分在真实胶囊左侧是否可排下；手机宽度不足应以可记录的原生胶囊适配解决，不能偷偷缩小所有源字级。分类现有 `sticky top=status + 92rpx` 与 JS 动态测量 `.category-scroll` 的附近定位要一并核对，不能只改顶栏高度而留下旧偏移。现有固定白色 `.discover-menu-shield` 是胶囊适配，不能未经测量把源 `relative` 改成其他吸顶设计。

## C：我的核心组件 `caper_1`

承载：`miniprogram/pages/me/me.{wxml,wxss,js}`。原稿 `code.html:113–286,344–399`；当前 WXSS:61–127 后置覆盖为最终样式，不能引用文件顶部已被覆盖的旧值。原 PNG 可看到稍大的品牌／头像与四列勋章、兴趣和白色隐私卡，当前保持模块顺序但尺寸更小。

| 位置与原 HTML 行 | 原稿明确值 | 当前最终值及差距 |
| --- | --- | --- |
| 品牌／设置／扫码，113–145 | Logo28／内部给定 play SVG16；中文16／英文10；设置和扫描按钮32／glyph20，完整原 inline path／stroke1.8 | 当前 Logo43 rpx（21.5）内 `▶`；中文30 rpx（15）／英文18 rpx（9）；按钮54 rpx（27）、`⚙`／`⌗` 代替原 SVG |
| 个人卡，146–171 | padding16；圆角24；avatar64、border2、白ring2；heading20／900；handle12、上距4；caption12／上距8 | 当前 padding29/24/26 rpx、全局卡radius26 rpx（13）；avatar109 rpx（54.5）/border3 rpx（1.5）；heading35 rpx（17.5）；handle20 rpx（10）；caption20 rpx（10） |
| 统计，175–198 | top gap20／padding-top16；主数18；label10、上距2；四等列 | 当前25 rpx（12.5）／23 rpx（11.5）；主数29 rpx（14.5）；label16 rpx（8）／上距7 rpx（3.5）。保留真实四项含义，不能照抄 18／6／128／9 |
| 章节／社交印记，203–250 | 章节14／marker6 × 14；链接12；章节上距20，下距10；四列gap8、卡padding10／radius16；emoji盒40、emoji20；标题12、副标9 | 当前章节24 rpx（12）／marker6 × 25 rpx（3 × 12.5）、链接20 rpx（10），章节上距31 rpx（15.5）；四列gap12 rpx（6）、emoji盒58 rpx（29）、emoji29 rpx（14.5）；标题17 rpx（8.5）、副标15 rpx（7.5）。第四图原 🤝，当前是 `♡`；不能照抄 LV3/MAX/TOP/99+ 奖励事实 |
| 兴趣，256–277 | 源静态示例chip12／padding6 × 14／gap8 | 当前20 rpx（10）／padding10 × 21 rpx（5 × 10.5）／gap11 rpx（5.5）。可恢复间距与字体，示意标签不能变为真实个人兴趣保存结果 |
| 隐私行，281起 | 卡padding14／radius16、行gap14；圆图形盒32／内SVG16，原自定义 SVG 不是文本 | 当前padding4 × 19 rpx、图形盒35 rpx（17.5），`◉`／`◎`；隐私标题21 rpx（10.5）。当前两类真实授权文案与待确认／不确定状态必须保留，不换成设计稿微信群／同城推荐开关 |
| 活动记录，344–399 | 2列gap10；卡padding8／radius16；照片96高／radius12；title12／meta10 | 当前2列gap13 rpx（6.5）；padding7 rpx（3.5）；照片188 rpx（94）、radius18 rpx（9）；title21 rpx（10.5）、meta16 rpx（8）。保留真实标题、日期、状态、示意配图和空态，不补虚构参与者 |

全页有 32 个原 inline SVG，包含公共底栏；能复用 XML path 就提取原 path，不能将 settings／scan 等换成不同图标家族。原稿本来使用 emoji 的勋章区继续用对应 emoji，并保留“待开放”。当前头像“我”是明确的无头像替代，不能把 Léo 照片当当前用户；在线绿点也不得借原稿样本宣称真实用户实时在线。原稿不具备当前 R1 高级安全工单表单的等价视觉区域，这些表单既有结构与语义留存。

真实业务：读取 `/me/events`、`/me/notifications`、`/me/blocks`、`/me/consents`、`/me/similar-invites` 等当前本人数据；两授权开关有提交中／不确定结果／重新核对保护。设置→隐私，扫一扫→说明后本人行程，兴趣→资料说明，勋章→概念馆，真实活动→同 ID 详情，查看全部／主办筛选→动态页，真实工单／隐私请求在高级区，邀请朋友按真实可邀请主办活动分流。`photo_album=false`，全局头像／昵称／勋章／收藏／兴趣和数据看板均无 R1 保存或授予接口。

本任务以静态原稿恢复为主；保留所有原业务 JS、WXML id／bindtap／dataset／disabled／wx:if、错误／部分读取态和高级区展开行为。若顶栏高度调整会影响 `focusSection` 的旧固定偏移，必须单列最小几何修正并定向验证焦点，不能以视觉重写整个 me.js。

## 独占范围与最小验收建议

| 并行任务 | 可独占写入 | 保留／交给 root |
| --- | --- | --- |
| A 首页 | `pages/index/index.wxml`／`index.wxss`、新 `pages/index/assets/` 原 path 与清单、独立首页证据 | `index.js` 业务、PG02-B/C/D／草稿箱视觉、共享素材、总矩阵、Tab Bar、微信工具、提交上传 |
| B 发现 | `pages/discover/discover.wxml`／`discover.wxss`、新 `pages/discover/assets/` 的固定版本 Phosphor 图形与清单、独立发现证据；必要时只有明确的顶栏测量字段改动 | 所有邀请／身份／列表业务、共享素材、城市页、总矩阵、Tab Bar、微信工具、提交上传 |
| C 我的 | `pages/me/me.wxml`／`me.wxss`、新 `pages/me/assets/` 原 SVG 与清单、独立个人页证据；只有必要焦点几何改动可单列 JS 最小差异 | 各 PG10 子页、授权／旧会话／写接口／高级工单业务、共享素材、总矩阵、Tab Bar、微信工具、提交上传 |

实现前 root 明确逻辑宽度与胶囊适配规则，三个任务共用规则但各自页面独占；不要共同写一个 SVG 清单或公共样式。每页 freeze 时交回准确文件 hash、原稿节点与素材证据和最小 JS 差异。新的独立 reviewer 核 source／最终样式及 R1 文案边界，root 统一同步源码、执行顺序明确的三个局部微信检查。

只需与改动匹配的有限检查：

- 首页首屏几何／SVG／真实主卡数据与同 ID 详情；城市、消息、个人和 Hero 预填原已有路径按受影响入口定向检查。若未改业务，不重复报名／人数／邀请全套。
- 发现四主卡原图层级／Phosphor 样式；搜索／收藏关闭态、全部清提示、附近目标与城市返回；一个当前身份的真实本人活动同 ID 详情。邀请业务无新改动时不重复整套 token／扫码竞态。
- 我的原 SVG／头像替代／章节及真实活动布局；设置／扫码说明与行程／勋章／兴趣／一个真实活动的已有路径，必要的授权焦点可见。样式修改不提交隐私删除、报名、授权或举报写操作。

不运行全量测试／全量业务矩阵／CI；本审计只建议验收点，本次没有执行这些检查。正式 AppID、HTTPS 合法域名、订阅消息、真机、真人运营及三场受控活动继续独立保留未验收状态；三个核心页修复也不代表全 39 屏同尺寸逐像素完成。

## 当前源码基线（本次只读快照）

| 页面 | 文件 | SHA-256 |
| --- | --- | --- |
| 首页 | `index.wxml` | `50d4920fd5d7b21562734404ff47d29187b4ad55b6063de8617d3af65dbbf187` |
| 首页 | `index.wxss` | `0310af529e2412376f74d48f79569a0a275f419503bb642bf44a20ad6e9ecae7` |
| 首页 | `index.js` | `c0e7f279fab82c31311f5ae4de6984d9631f47cb7486468d1ebe77896d082b88` |
| 发现 | `discover.wxml` | `0e2115fbc2da39fc7054437ac64cafe7a9ed424a77435674c6370c4978d544e0` |
| 发现 | `discover.wxss` | `4f8490865cdd073e94d898cf6cf427de871f32842bf10ec390d4c22158d60d8c` |
| 发现 | `discover.js` | `9644a52f186b3f5ce3b99389849571f8a8110c3a3045c70f383ee407c7c9592a` |
| 我的 | `me.wxml` | `ca097d68a57fa22cfbab5852e69e3708e5ba68bacf9dbaa7af8cd7af28aac0d3` |
| 我的 | `me.wxss` | `c3b12c2a32621b74d88ecea38079638636f530eabdc57b7b15aaa76c978d8538` |
| 我的 | `me.js` | `def9a36a9c46deca17cebbe95e5bd8672469eea6e759fd279b45d28c9f87021b` |
