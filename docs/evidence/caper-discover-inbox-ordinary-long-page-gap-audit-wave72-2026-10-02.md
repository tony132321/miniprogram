# 普通发现与消息长页：下一批原稿差距审计（Wave 72）

日期：2026-10-02。仅只读盘点；没有修改产品、共享字体、配置或验收矩阵，没有 Git 操作、SDK／CLI／全量测试。本报告可拆为两个独占实现任务，后续实施须另行放行。当前 N2 产品和 Wave 72 我的长页独审仍冻结。

## 1. 来源先纠正：按实际 title／内容识别

| 实际页面 | 用户 ZIP 目录 | 完整 HTML | 完整 PNG |
| --- | --- | --- | --- |
| 发现：`耍起 CAPER - 找局 · 发现` | `caper_4` | 63,270 B；SHA256 `514d9e5fbfbbc66e9c5c19cf33767b58b54f77a144720c4b89f3b5248356aed2` | 265,845 B；`15ffd670e926b6f508dac5223bb00e3beee8301a6a712a3836d468893a95d63e`；176×1600 |
| 消息：`耍起 CAPER - 消息` | `caper_3` | 32,137 B；`18fab22c6b92592673e19574739eb2ed86cbfb0fe628023ec5dcd3b843a1aa6b` | 210,560 B；`85fc42cb05ea57b3afe81c594917572ead3122dfa5feb958595574fb5901da1b`；290×1600 |

已阅读两份完整 HTML，并查看两张完整 PNG。两 HTML／PNG 与 `/Users/tsb/Downloads/stitch_design_system_generator (2).zip` 内对应四个 entry 逐字节相同。缩小长图只用于确认模块顺序／绘制，不据其宽度倒算 CSS。发现原 `.app-viewport` 为 width100%／max390；消息原 viewport／外框 fixed390。固定字号与控件值取实际原 CSS；微信状态栏、胶囊、真实安全区继续沿用已恢复适配。

只读完整清单和精确预算放 `/private/tmp/caper-wave72-discover-inbox-gap-audit/`：

- `source-current-inventory.json`：原 sections、完整图片 URL／节点、图形祖先 class、当前文件 hash／实际动作。
- `proposed-protected-regions.json`：可实施边界的当前精确字节。
- `exact-glyph-candidate-budget.json`／`candidate-svg/`：只在临时目录序列化准确既有官方字形以计原始字节；不是运行素材或渲染通过证据。

## 2. 可并行独占边界

| 任务 | 可修改范围 | 必须保护 |
| --- | --- | --- |
| D：普通发现长页 | `pages/discover/discover.wxml` 从原 `section-heading` 灵感推荐起的长页；自己的新增 scoped WXSS；自己的少量准确 SVG／来源／证据；原末尾 create-card 可按原 CTA 恢复表现 | JS 17,758 B／`928b72be56fca9c7cd4d2a8fd8f76d14632ef9c315dbfb2ea62c97a9c81712b5`；JSON147 B／`d09ff0a32fee5e70496a03f5c691f07462d0c9ea399dd69ae9f198e6ba1cc451`；核心顶栏／分类／四卡、公开能力提示、邀请输入／预览／扫码整块，现有全部动作及有效条件 |
| M：普通消息 INBOX 长页 | `pages/messages/messages.wxml` 的最近会话闭态、真实通知分组、AI／提及／相册／尾段；只新增 `.messages-inbox` 下独立长页 selectors；自己的准确 inline SVG／来源／证据 | JS32,969 B／`b297f95f560581abc5718b4fe35cb66453601f1e0948e6940800e4eb8e10a8c0`；JSON63 B／`b76e69c65eadf25397e0df5c9457c5a098c1bfc714ae05be5441318bdc8ebacc`；INBOX sticky header／priority 原段、搜索／真实审批／分页／异常与身份状态；整个 CHAT、N1 CARDS、N2 COMPACT；旧 CSS 全前缀 |

当前发现 WXML15,967 B／`712b837104da4ba86ac372b2a9f2a1bad7b5aff9df40c9fa5b8b14b95f62bc8c`、WXSS21,968 B／`b2e7823086c5f30b69ba25bf1605136e52bcefd0d48cbb94f4c03abb65d32e13`。消息 WXML34,914 B／`69208a8ae7b49fef663ac51ef723f45248959b29aa0c3ad649507d174c0c1e13`、WXSS67,613 B／`2b8787c83c01314c1a23b5d2549984c251e842180cd8206ee4553304f3907c7a`。这些是本次读取值，不替代根代理最后冻结／编译值。

发现受保护核心 prefix3,868 B、能力提示346 B、邀请整块1,459 B；消息受保护 header2,045 B、priority1,043 B、非 INBOX suffix23,282 B，逐块 hash 见临时清单。两实现者互不写同一产品目录；公共 Tab、app／字体／配置／其他页面不在此范围。

## 3. 发现长页具体差距

通用原 section 多数是 mt20／水平16／pt12／pb4／top border4 `#f1f5f9`；heading16px／24px／800，普通 link12px／16px／600；subtitle11px／16.5px `#94a3b8`。当前 `.section-heading` 为30rpx margin、20rpx pt、7rpx边、27rpx／850，且符号多为 `✦／⌖／♧／⌂`，不能作为原 Phosphor 字形。长页没有统一原 body font-family。

| 原 HTML 模块 | 准确关键角色 | 当前差距／最小实施与真实边界 |
| --- | --- | --- |
| 273–345 推荐 | 横卡200px／r12／边1／shadow-sm；gap12；封面112px；from-black80→透明；favorite24px／bold heart12白；body10px；title12／16／700；facts10／15；footer mt10／pt4；标题 sparkle fill18蓝＋pulse | 当前卡245rpx、封面143rpx、body10–13rpx、字符心，没有原渐变／时间与地点角色。沿用 `recommendationCards`／`rotateRecommendations`／`openInspiration`，文案继续“灵感”；无个人化推荐接口，不复制原日期／地址／报名+8／+16／+9。原推荐图片顺序冲浪、露营、看展与当前首组冲浪、看展、咖啡不同；JS冻结下保持真实两组数据，仅恢复其相同组件，须注明数据差异，不能声称整 PNG 相同。 |
| 348–393 附近 | mt20／pt16／pb8；12列左5右7／gap12；map r16／emerald50／边emerald100／p10；14px绿色网格alpha20%；中心32px ping＋20px蓝／白边2、navigation-arrow8白；右侧48px图／r8、title12／16、facts10／15／gap8 | 当前宽42%简化斜线地图、36rpx字形点、52rpx缩略图。恢复源容器／准确非定位示意；真实 `nearbyPersonalEvents` 最多3条，必须保留 `READY && length>0` 与 `openPersonalEvent` 身份白名单，继续标“本人／非公开”。无位置权限／经纬度，不复制3km／12活动／1.2km等定位事实，不加导航 API。 |
| 398–422 三专题 | 145×80px／r16／p10／gap10；粉pink400→rose400，cyan400→emerald400，amber300→lime；kicker9／900／tracking.05em；title14／14／900／tracking−.025em；底角30px bold sparkle／compass／moon-stars，white30%／black15% | 当前250×126rpx、不同渐变／符号／字级。沿用三个 `openInspiration` 与原 data-title；无专题报名服务。 |
| 427–513 主理人 | 原8槽横排w56／gap16；circle48、ring2 lime／blue或ring1 slate200／p2；name12／16／700；specialty9／13.5／scale.9；verified16px | 当前没有此模块。可以恢复该源 section 与闭态空槽说明，但没有公开主理人目录字段；不可把本人活动数据当八位主理人，也不可生成 Luna／Ken 等名字、头像／认证。新增“全部”只能明确 disabled闭态，或复用已授权真实本人活动入口并写明语义，不能偷加查询后端。 |
| 519–584 朋友参加 | fill users-three16蓝；原三卡200px／r12／p10／gap12／slate50；hero80px／r8；title12／16／700、facts10／15；avatar14px | 当前“与你有关的活动”已经真实 `/me/events`，却用330rpx卡／145rpx封面等旧值。可对这组真实卡恢复对应源卡角色，并保留原 loading／error／empty／所有活动入口。没有好友图谱，不能展示“3位好友”等或伪造 A／B头像；身份来源仍“我参与／我主办”。 |
| 590–604 瞬间拼贴 | 3列／gap8／6×112px／r12／p8；各格原独立渐变／位置与墨色；Good People／Brighter Days、Life is Better／together、Same Vibes；text-sticker Caveat／Segoe Print、tracking−.02em；源 inline 覆盖值须按级联核 | 当前210rpx格／gap10rpx与统一低部遮罩、全大写字；第一格用了篮球而原是公园图。可恢复排布和贴纸，只能保留“灵感示意”，不可声明社区真实活动照片。照片准确来源边界见第6节。 |
| 609–657 评价 | 原3卡240px／r16／p12／gap12／slate50；30px serif引号；text12／19.5／500／pt12／pl12；footer mt12／pt8／边slate20060%；原avatar24 | 当前单块22rpx padding／52rpx表情。恢复源评价容器与闭态内容，“当前没有公开评价”；无真实评价记录，不复制原三段用户证言／handles。原源 heading 本身没有“全部”，现 `goPersonalAll` 属真实附加入口，应保留原资格／明确真实用途。 |
| 663–731 周精选 | 3列／gap8／6卡p8／r12／border1；cover64／r8／mb6；title11／16.5／700；date9／13.5；分类贴纸9px | 当前91rpx cover／不同底色与rpx字级；6静态主题已可沿用。保留 `openInspiration` 六 data-title，日期／分类用真实闭态描述，不能捏造周末场次。`shadow-xs`在原 config未定义，勿补自创影。 |
| 736–749 路线 | 220×112px／r16／p12／gap12三卡横排；照片＋black85／40／30梯度；手写14、title14／20／900、metadata10／15／slate200 | 当前两列160rpx、第二图徒步不是原展览、仅低半区渐变。沿用现有 `openInspiration`、`openCity`；新增原第三视觉槽如为静态灵感，须明确来源和闭态。无路线字段／距离／地图服务，不复制8个地点／3.5km等事实。 |
| 754–767 场馆 | fill buildings16indigo600；两列gap10；4卡r12／边1；封面80px／black40居中label12／900；body8／title12／16／700／metadata10／15 | 当前166rpx整图按钮、只有下部title，源公园图缺失，其他图用途也不同。恢复原结构但继续“场景灵感／未核营业／未预订”；沿用4个 `openInspiration` data-title，不展示未经验证商家名称／距离作为实际场地服务。 |
| 772–790 底部CTA | mt24／mx12／mb24；r24／p16；blue600→indigo600→blue700；shadow-lg blue200；robot48／r16／white10%／blur12／borderwhite20%；arrow36白／bold16蓝／shadow-md／hover1.05；背景glow96／blur24 | 当前发起卡19rpx／蓝色纯底／58rpx“＋”。可恢复 sourceCTA 表现、沿用 `goCreate`，文字保持发起真实活动；没有AI找局服务，不声称推荐。原真实邀请输入／预览／扫码保留为附加区，不用假 source按钮替代。 |

### 发现按钮／数据合同

实际长页现有27个静态动作声明：换批1、灵感主循环1＋收藏catch1、城市2、本人活动循环2、专题3、真实“全部活动”2、发起2、周精选6、路线2、场景4、路线城市1；末尾 create-card 另1个 `goCreate`。这里循环模板声明不等于真实渲染按钮个数。最小实施保留完整动作属性／data-title／data-id、有效 wx祖先，以及真实空态／错误态；不逐条新增镜像样式测试。

`discover.js` 已有会话／邀请 token身份、generation、同 token回调、本人活动白名单。`openPersonalEvent` 同时要求 `_shownIdentity===currentIdentity()` 与 items中包含 ID；`previewInvite/openInvite/scanInviteQr` 同口令与身份边界保留。`openInspiration` 的原确认只去真实发起。`rotateRecommendations` 本来是两个静态灵感组切换，不是AI接口。JS全字节保护即可避免重复已有业务。

## 4. 消息 INBOX 长页具体差距

原 main水平16px／space-y16／pt4；源普通card白／border1 `#f1f5f9`／r16／shadow-sm，常见p12。现外层26rpx、card r23rpx／复杂自创影，长页多为rpx。新增规则须限定 INBOX 长页，不能写裸 `.card/.hint/.notice-row`，否则会改变已冻结 N1／N2／私聊。

| 原 HTML 模块 | 准确关键角色 | 当前差距／最小实施与真实边界 |
| --- | --- | --- |
| 127–216 最近会话 | card p10／r16；4 row p10×6／gap12／r12／hover slate50 80%、transition-colors；avatar44px；name12／18／700、category10／15、time10／15、summary12／18、unread16 | 当前一个68rpx字符信封／112rpx minheight。可以恢复单一匿名闭态行的源结构与44px圆形，保留唯一 `openPrivateChatPreview`。没有私聊接口，不复制 Alex／Momo／Luna／Kevin、会话、时间和2／1未读，也不能制造4个真人样式假会话。 |
| 219–269 未读优先 | 已恢复 source40px／card inset16、真实 `priorityItems`／`priorityCount` | **保护原段，禁止重做**。它的 `openNotificationCenter` 与 `openNotice` 2个动作虽在长页读取范围，属于已有Wave66验证。 |
| 273–311 活动动态 | heading12／18／700＋emoji14；link11／16.5／600；source card p10／r12／bgslate50 70%／border1，gap12；icon32circle＋glyph16，title12／18、time10／15、summary11／16.5；item gap10 | 当前真实3组是互动与审核／活动动态／系统通知；group徽章68rpx，row／head／notice summary字级旧rpx。可恢复对应 source通知行容器／px字级，保持全部 `noticeGroups` 和真实kind／summary／externalHint，不能强塞固定2条。源绿色人群仅“报名已通过”真实kind可映射；粉地图仅 `MATERIAL_CHANGE`可映射，不能把EVENT_CONFIRMED或泛系统通知称为“本人确认参加／地点刚改”。其余真实kind保持原真实状态样式并说明不同数据。 |
| 314–352 AI卡 | indigo900→slate900→slate950；r16／p14／shadow-md；glow128、right/top−32／blue50020%／blur40；heading12／18；orb40px外渐变p2／内slate950／lime10pulse；title12／18、tag9／13.5；copy12／19.5／mt6；buttons11px／px12／py6／gap8／mt12 | 当前55rpx字符星／没有准确glow／orb／原heading和copy结构，padding24rpx。恢复原明确源层、pulse等。保留当前真实“AI尚未开放”文案与唯一 `goDiscover`，不能原一键确认批量审批或伪造2／3推荐数。原第二按钮如恢复可 disabled＋明确闭态；没有handler／假成功。 |
| 356–378 提到我 | card p12／r16；header12px；row p8×4／gap12／avatar40px、title12／18、time10、summary12 | 当前仅 preview heading／hint，源avatar和内容结构缺失。只能匿名闭态，不能复制群提及／Luna／@我消息；原“全部”未绑定，若保留视觉必须disabled／明确未开放。 |
| 382–432 相册 | card p12／r16；header mb10；横排5卡 **96px**／gap10／pb4；cover64px／r12／p4／bottom-center emoji18；title11／16.5／700 mt4；note9／13.5／600蓝；五个准确渐变 | 当前4卡188rpx／gap16rpx、居中36rpxemoji、不同渐变。源没有任何 `<img>`、无需素材下载；五槽都可CSS恢复并注明灵感示意，不能12／8／15／9／11张照片假计数或真正album操作。 |
| 436–465 历史、469–486结束、490–510归档 | 各card p12／r16；header mb8；row py8／px4／gap10；icon32／r8／emoji14；title12／18／700、date10／15、summary12／18；源归档mute SVG14 | 当前没有三个模块。可恢复源闭态组件，不把当前通知 OPENED 等同“已结束活动会话／归档”，无历史会话、通知archive／mute数据。原末尾mute并非支付／通话服务，若展示必须disabled闭态。 |
| 514–527 品牌横幅 | blue50→indigo50→lime50；p14／r16／borderblue10070%；title14／20／900／tracking−.025em；desc11／16.5／500 mt4；yellow300贴纸p6×8／r4／9px／900／rotate2deg／shadow-sm | 当前p19×20rpx、字体23／17rpx、贴纸rotate3deg、不同shadow。恢复精确原值；无新业务或asset。`shadow-2xs`原config未定义，不能补影。 |
| 531–540 设置 | 白／p12／r12／border1；bell14；gap10；title12／18／700；sub10／15／400；右“>”12／700 | 当前p23×24rpx、右chevron31rpx。沿用唯一 `goNotificationSettings`；该方法有身份清理，并传 `notificationSettingsSection` intent到我的页，不能在此伪造push已开或加载新设置。 |
| 543–550 footer | pt16／pb8；上9／13.5／900／tracking.1em／uppercase；下10／15／700／mt4，两个24×1px slate200短线／gap8 | 当前15rpx文字且无双线／padding。恢复原样；tagline只静态品牌文案。 |

### 消息按钮／数据合同

普通长页真正需保留6个声明：`openPrivateChatPreview`1、通知row `openNotice`1＋原签到／补记子按钮 `openNotice`1、`loadMore`1、`goDiscover`1、`goNotificationSettings`1。加受保护 priority2共8，不能把它们全部算成新动作。markAllRead、search、审批、center-entry／非INBOX布局等在该源审中只读、不重新验收。

真实 `displayed()`／`noticeGroups` 已从同 collection投影，筛选语义保持 `groupFor()`；`REGISTRATION_APPROVED`属于INTERACTION，不应为好看挪到ACTIVITY。真实通告请求／外部提醒受理不等于发送成功，`externalHint`必须保留。`openNotice()` 重新从 collection匹配id／kind／event_id，当前身份＋generation保护，再按原same-ID section跳转后post open；UI恢复不得简化为dataset直接跳转。通知无会话status字段，不能凭OPENED做“历史／已结束／归档”记录。原 `loadMore`的nextOffset／loadingMore条件和所有error／unauthenticated／LOADING状态完全保护。

## 5. 字体／图形准确来源：可以复用，不再造一套

- 发现body实际 custom样式：`-apple-system, BlinkMacSystemFont, "SF Pro Display", "PingFang SC", sans-serif`。原 config也列SF Pro Text／Hiragino／Microsoft YaHei，但body没有font-sans class，不能把未用fallback当原实际family。手写class是Caveat／Segoe Print／cursive；原HTML**没有Google Fonts link**。已有全局Caveat700可复用声明，但来源浏览器缺字体时实际fallback与微信字形仍须标绘制边界，不能声称原稿导出用过下载字体。无需新fontface。
- 消息body实际 font-sans：`-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif`；其配置handwriting为`"Comic Sans MS", Chalkboard SE, sans-serif`，长页没有明确实际handwriting消费者。不可把Jakarta／Caveat替换消息系统栈。新增字体预算0 B。
- 发现源图形来自固定官方 `@phosphor-icons/web@2.0.3` 的 regular／bold／fill；完整官方CSS／TTF已保存在 `docs/design-sources/phosphor-web-2.0.3/`。来源／SHA／许可同 `source.json`、`package-integrity.json`、`docs/licenses/phosphor-web-2.0.3-MIT.txt`。源npm版本2.0.3、字体name-table版本2.0须分别记录。直接复用准确outline／1024em／y轴变换 `(1,0,0,-1,0,960)`；不能用Material或Unicode形状替代。
- 长页需新增候选paint variants18个：fill sparkle／map-pin／navigation-arrow／users-three／chat-circle-dots／purple compass／indigo buildings；bold blue arrows-clockwise／blue caret-right／gray caret-right／white sparkle／black compass／black moon-stars／blue camera／blue arrow-right；regular slate500 calendar／slate500 map-pin／slate200 map-pin。原white bold heart已有准确SVG，可直接CSS12px渲染无需拷贝；场馆slate400 map-pin亦已有精确颜色。白sparkle30%与black专题图形15%用原consumer opacity，不新造outline。
- 18个临时候选官方SVG序列化总 **18,787 B**，不是必须全部新增或编译净值；实际保留的闭态模块可少于此集合，产品实现时按真实消费者精简。现已有心形990 B不计新增。
- 消息仅需原285／299行的两个inlineSVG（绿色人群、粉地图）作为真实kind对应候选；children字串保持原字节，继承色outer明确化。临时两个SVG总 **618 B**。非必须的归档mute若没有真实对应业务可以不增加；源文字／emoji不是新增raster资产。已恢复header与Tab图形不重做。
- `py-0.2`、`shadow-xs`、`shadow-2xs`在两原Tailwind config没有扩展定义；不能按0.8px／“很小阴影”猜。源default tokens、层叠覆盖、pulse／ping／hover等若实现需要，应只做一次该长页源CSS观察，不重跑以前整套字体／核心check。

## 6. 图片与最小包预算

发现完整原HTML只有 **8个唯一图片URL**，消息0个。八URL及全部节点见临时inventory。发现核心4图＋surf／camping／art七候选当前已有运行文件，共529,067 B（本次读hash）；核心／此前资源保持，不重复下载、不重编码。当前目录没有原第八公园图（原391附近、603第一拼贴、766最后场馆同URL），不能用篮球或城市照片冒充该原图。

| 当前候选 | B | 当前SHA256 |
| --- | ---: | --- |
| caper_discover_citywalk.jpg | 63,210 | `29ec54d0a3ad4928008e957d8229c72d0a357167098d458d749c4d391d09faa2` |
| caper_discover_basketball.jpg | 80,784 | `e38ebfbe65bad920fcfd9861f82b4d3c558bf8584dffbd237b1cd5a8ee1a35a2` |
| caper_discover_coffee.jpg | 75,091 | `8c0b55f856d8fbf2fc565b240aff905bcd4a8a0fdc5db4e2047591bebb71d07e` |
| caper_discover_boardgame.jpg | 93,870 | `0496a27ec5e007deba173ce6a54c882fadba2d882babf0010a3b7ade1116a070` |
| caper_discover_surf.jpg | 61,363 | `7e8d064a4d9b4f4ecd2ae282cee3089322dbe036f8bfda9f71c32ddacd768956` |
| caper_discover_camping.jpg | 84,585 | `583817d363bf087b5581ec58df7427c6ff1e079082bd4550ca4d2b1b6c00b621` |
| caper_discover_art.jpg | 70,164 | `84a0a5c6ce78fe0918d7edbaf75f010a2b255f239219344a8e65e10850745bbd` |

已有来源材料记录现有核心文件hash，但没有把这七文件逐一与原URL响应字节绑定的完整photo manifest。因此这里称“现有候选”，**不宣称原URL／原始字节已证等**。最小新增照片预算在来源复核前为未知：第八公园图必需先由实施者在独占temp精确请求原URL，检查媒体／byte／hash再决定可用预算；七图如确不是同一原响应，也必须向root报告真实缺口，不能凭文件名／照片主题当同源。当前审计未请求／下载／压缩任何图片。

可证明的新字体为0 B；消息照片为0 B，候选inline为618 B；发现全候选SVG18,787 B，现图复用新增0 B，但缺原公园图字节未知。JS不增、图片无损迁移或分包策略由root另作必要决策；CSS／WXML新增字节在实现前未知。原始字节和临时serialization均不能推断小程序编译大小，最后由root的一次实际preview决定是否过2 MiB，不能引用旧157,404 B余量为当前可用结论。

## 7. 必要验证限定

后续两个实现者各自只做一次新增scope的来源／有效动作祖先／完整逆除保护／准确资源清单；不新写rpx/CSS镜像断言，也不重跑Wave64、66、69、70、71、72旧checker或所有fonts／业务／全量。当前审计脚本只是读文件／来源／临时字形预算，首次inline预算手录行号289、284错误导致辅助脚本失败，核真实285／299后修正脚本，产品未受影响；不把该辅助错误算产品测试失败或“新UI已通过”。

根代理届时只限定检查新增INBOX长页实际点击／通知same-ID与来源布局、发现推荐换组／个人同-ID／邀请保护入口及原滚动anchor，实际包体／截图。已经恢复的核心／priority／N1／N2／私聊／Tab保护字节足以避免扩大测试；新真实异常出现再定点修。未开展新原生绘制／字形／真机验收，未声称两个长页或整项目已经完成。
