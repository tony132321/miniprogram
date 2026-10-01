# Wave 65 下一批原稿差距盘点：消息、活动构思、访客活动详情

日期：2026-10-02。性质：只读原稿与当前源码盘点。此次只写本文件，没有修改产品、共享文档或素材，没有调用 Git、微信 CLI／SDK／computer use，也没有运行测试。本文件不是新增视觉或功能通过证据。

## 结论与本批最小范围

建议三个实现者并行处理以下 **三个组件范围**。三个目录互不重叠，复用当前业务和已存在的图形来源流程；每个实现者独占本页 WXML、WXSS、新页内 assets 与独立证据，root 统一处理工具状态、共享文档、提交和上传。

| 优先项 | 真实原稿映射 | 建议最小改动 | 明确留在后续的同路由状态 |
| --- | --- | --- | --- |
| A 消息 | `caper_3` → `pages/messages/messages` 的 `INBOX` | 原顶栏、标题贴纸、三筛选、未读优先卡；替换顶栏两个原 SVG，恢复这些组件的明确几何 | `CENTER` 对应 `pg02_n_1/2`、`CHAT_UNAVAILABLE` 对应 `pg11_c_alex`；INBOX 其余长页模块也不随本批自动通过 |
| B 发起 | `pg03_ai` → `pages/create/create` 的 `IDEA` | IDEA 顶栏、Hero／助手球、自然语言输入卡、灵感卡、底部生成和既有手动入口；准确 Material outlined 图形 | `FORM` 对应 `caper_ai`、`REVIEW` 对应 `pg04`，包括编辑已发布活动／重大变更流程 |
| C 活动 | `pg01` → `pages/event/event` 的普通羽毛球访客详情 | 蓝色海报、叠层白色信息区、时间／地点、主办卡、席位与底部操作的明确几何及原图形 | 主办／已确认成员 `_4/_2`、报名确认 `pg05`、成功 `pg04_s/pg05_s`、主办工作台及公告／签到／AA 等分区 |

**状态定义：** C 的样式范围须同时满足 `loadState === 'READY'`、`activeSection === 'detailsSection'`、`!successState`、`display.isBadminton`、`!isHost`、`myRegistration.status !== 'CONFIRMED'`；若 `joinConfirmation` 打开，底层详情不得覆盖确认层。普通 generic 活动、已确认成员和主办详情使用不同原稿，不能以一个 `.poster`／`.detail-section` 全局覆盖完成。

本批沿用 Wave 64 已确定的 **原 CSS px 字面值** 口径；布局宽度按微信实际窗口适配，状态栏、胶囊、底部手势区域单列平台适配。原 PNG 都是输出图，不能把它们的像素宽度当 CSS 逻辑窗口。没有重新审查或重做 Wave 64 已完成的首页／发现／我的组件。

## 阅读和证据范围

已读 `docs/acceptance-matrix.md` 当前 2026-10-02 首项 Wave 64 及相关 Wave 53／57 的局部边界，`docs/stitch-ui-parity.md` 的三个页面及其状态映射，Wave 64 原稿范围审计和计划的源 px／平台适配规则。Wave 64 的 90 局部断言／14 交互、Wave 53 的未读通知同 ID 跳转、Wave 57 的快捷日期等是既有批次证据，未被重算为本批通过或全项目百分比。

本次完整阅读以下三个 HTML，直接查看三个原 PNG，读取当前目标组件及有效后置 CSS、JS 对应跳转方法、JSON 导航声明和共享 app.wxss。对下表三个 HTML／PNG 逐字节核对 `/Users/tsb/Downloads/stitch_design_system_generator (2).zip`，六文件均一致。未请求新设计、未抓取远程媒体、未下载字体。

原稿目录：`/private/tmp/irl-stitch-original/stitch_design_system_generator/`。

| 原稿 | HTML 字节／SHA-256 | PNG 字节／SHA-256／像素 |
| --- | --- | --- |
| `caper_3` | 32,137 B；`18fab22c6b92592673e19574739eb2ed86cbfb0fe628023ec5dcd3b843a1aa6b` | 210,560 B；`85fc42cb05ea57b3afe81c594917572ead3122dfa5feb958595574fb5901da1b`；290 × 1600 |
| `pg03_ai` | 20,435 B；`a9dcecb66acbfe35c004d66b178dd3594197b2d5b1688c6feaada09a30ca0497` | 486,721 B；`b6cfb7394783c1793a823be7065822a14ce38c635eaaead09467aa9506b78463`；718 × 1600 |
| `pg01` | 27,174 B；`ae12d6f11a51ffaccae03ae8b27f02144ee6f4c00a072e75edb933ff1aea88c4` | 518,883 B；`33cd936b61a39af9f4d18220897ee48283de72153bf6e286d478147eda0b52a2`；532 × 1600 |

`caper_3` HTML 固定宽 390 px；`pg03_ai` 是 `width=device-width` 的全宽页；`pg01` 是 `w-full max-w-[425px]`，海报 `aspect-[4/4.8]`，宽度小于 `sm` 断点时高为宽的 1.2 倍。下表括号内现状 px 仅为 **375 px 窗口、1 rpx = 0.5 px 的源码比较**，不是此次微信测量结果。真正的字号／阴影／字形渲染仍须 root 后续在实际窗口记录。

## A：消息 INBOX

目标原稿 `caper_3/code.html:53–137,218–271`；当前 `messages.wxml:1–32`、`messages.wxss:50–174`。该 HTML 全页有 14 个 inline SVG，包含模拟状态栏和公共底栏；最小范围只需要原搜索／设置两个 SVG，原 emoji 继续是 emoji，不需要 Material 或 Phosphor 字体。

| 位置 | 原稿生效几何／结构 | 当前源码及差距 |
| --- | --- | --- |
| 顶栏与内容边距 | 原 header `px-5` = 20 px；main `px-4` = 16 px；header 本身 sticky，包住品牌、标题和三筛选 | `.messages-page` 左右 26 rpx（13）；只有 `.messages-brand` sticky，标题／筛选在外部滚动。不能只将一个品牌行命名为“原吸顶顶栏”而忽略结构差异 |
| 品牌 | 蓝色 logo 32 × 32、白色“耍”；文字 12／9，logo 与文字 gap 6 px | logo 46 rpx（23）、字为 lime；文字 22／15 rpx（11／7.5），gap 9 rpx（4.5）；原胶囊宽度需另适配 |
| 搜索／设置 | 两圆按钮 32 × 32，glyph 16 × 16，gap 8；搜索 stroke 2、circle `cx=11 cy=11 r=8`，设置是原给定 path＋circle | 47 rpx（23.5）按钮、8 rpx（4）gap，内容 `⌕`／`⚙`。这些文本和不同家族近似图标都不是源 SVG |
| 标题／贴纸 | 标题 24；副文 11、上距 2；蓝贴纸 11／padding 2 × 8／-3°；黄色贴纸 10／末行 9／padding 4 × 8／+3° | 标题 43 rpx（21.5）；蓝贴纸 13 rpx（6.5），黄贴纸 14／11 rpx（7／5.5）；padding、旋转和顶部偏移也不同。实际未读数保留，不能写死 3 |
| 三筛选 | gap 8；文字 12、上下 padding 6；三项等宽；源活动项红点只是示意状态 | gap 7 rpx（3.5），文字 17 rpx（8.5）、上下 11 rpx（5.5）；已有三项绑定可复用。不得为贴近红点补虚假未读事实 |
| 未读优先外壳 | 白卡 radius 16／padding 12／border `#f1f5f9`；heading 内水平 4、下距 8 | `.card` radius 23 rpx（11.5）；priority padding 15／18／3 rpx（7.5／9／1.5）；heading 5 rpx 下距（2.5） |
| 未读优先行 | 行上下 8、左右 4、gap 12；圆形标识 40；红 badge 16；分隔线 1；正文／时间 12／10 | 行 10／2 rpx（5／1）、gap 12 rpx（6）；标识 55 rpx（27.5）、badge 22 rpx（11）；标题／时间 19／13 rpx（9.5／6.5）。原两行是人物会话示例，当前两条真实通知和类别需要保留 |

当前 `.card`、`.filter`、`.empty` 等类同时影响多个模式。新增一层 INBOX scope class 或明确 scoped selector，避免把 CENTER 白卡和私聊闭态也改成 `caper_3` 尺寸。真数据长度可能比原示例长，保留当前 ellipsis／可用宽度处理，但恢复原指定的图形盒和间距。

### 已有动作，可复用且不需要重写

- 搜索→`toggleSearch`，对已加载本人通知过滤；三项→`setFilter`。保留 READY 条件、搜索说明、分页和无匹配状态。
- 顶部／底部设置→`goNotificationSettings`→`/pages/me/me`，实际焦点 `notificationSettingsSection`，有身份切换挡板。
- 未读优先“全部”／通知中心→`openNotificationCenter`，清除搜索、四分类并隐藏 Tab；返回→`backToInbox` 恢复 Tab。
- 真实通知→`openNotice`，要求当前 id／event_id／kind 与实际记录匹配，同 ID 活动和对应 section，导航成功后才记录打开；其读取／标已读／重放保护不动。
- 最近会话闭态→`openPrivateChatPreview`→`CHAT_UNAVAILABLE`，回到 INBOX、本人活动和通知中心都是已存在目的地；不能把 Alex／Momo／Luna／Kevin 原示例会话当真实记录。

### 其余 INBOX 原稿差距：记录，先不扩大这一批

原稿活动动态为内嵌淡灰小卡（padding 10、radius 12、icon 32），当前是通用分组通知行；原稿 AI 卡 padding 14／radius 16／40 px orb，当前 24 rpx／24 rpx／55 rpx，且当前真实关闭说明是必要适配。相册示意图原 96 × 64、gap 10、emoji 底部对齐，当前 188 × 128 rpx（94 × 64）、gap 16 rpx（8）、emoji 居中；原五个示意项，当前四项。原“历史会话”“已结束会话”“归档／免打扰”没有真实聊天服务，不能靠复制原静态人物和日期补齐。

品牌条、底部设置和长页其他区块仍有 rpx／原 px 差距，留到后续明确范围。关闭态可以沿用原卡片视觉，但不得新增假未读、已发送、AI 推荐／一键确认、照片数量、群聊或免打扰已生效断言。CENTER／CHAT 原稿未在此次重新逐节点审查，不能借此次报告称它们已完成。

## B：活动构思 IDEA

原稿 `pg03_ai/code.html:1–154`；当前 `create.wxml:1–35`、`create.wxss:6–51`，并读取实际 `stage`／跳转及 `suggest` 方法。原稿全页无 inline SVG，使用 **Material Symbols Outlined**；这是和发现页 Phosphor 不同的真实原稿来源。

| 位置 | 原稿明确值／结构 | 当前源码及差距 |
| --- | --- | --- |
| 顶栏 | 固定顶栏；动作行高 56、水平 16；返回 hit box 44、glyph 24；草稿圆 pill 高 32／横 padding 12／glyph 17；个人圆 32／glyph 18 | `.page-header` 高 96 rpx（48）、相对定位；返回 65 × 72 rpx（32.5 × 36）、`‹`；个人 52 rpx（26）CSS 人形；草稿内容 `▣`。原生胶囊占位必须单列，不能为了放满操作把字体缩小 |
| 内容节奏 | 主内容水平 16、顶部 8、组件 gap 20；Hero 上 4，文字右 padding 8 | 当前 hero 横 29 rpx（14.5）、顶部 30 rpx（15）、min-height 286 rpx（143），其余模块各自 margin；无一个稳定 20 px 栈节奏 |
| 助手球 | 80 × 80，蓝黑→紫渐变；眼睛是 8 × 10 胶囊、gap 10；反光 20 × 10、粉色腮红 6 × 4；lime 轨道粒子 14，浮标签浅紫／6° | 149 rpx（74.5）圆，眼睛／腮红是文本 `●`／`•`；缺源反光、轨道粒子；标签白底＋8°。应重用原 CSS 图形层，不能新画别的吉祥物 |
| 输入卡 | radius 24、padding 16、min-height 168；send 圆 40／glyph 20，计数绿点 6 | 当前 radius 36 rpx（18）、padding 27 rpx（13.5）；textarea 高 225 rpx，footer 71 rpx；send 68 rpx（34）、`➤`。真实 aiText／计数继续使用当前状态，不导入原 64 字示例 |
| 灵感 | heading 上 4；卡堆 gap 10；卡 radius 18／padding 14／gap 14；图形盒 44／radius 14 | 当前 heading margin 34 rpx（17）／下 17 rpx（8.5）；卡 radius 30 rpx（15）、padding 17 × 23 rpx（8.5 × 11.5）、下距 15 rpx（7.5）；盒 77 rpx（38.5）／radius 22 rpx（11） |
| 灵感动作图形 | 刷新 `cached` 16，卡右 `arrow_forward_ios` 18，quote `trending_flat` 14；咖啡原 `☕️`、酒局原 `🥂` | 当前刷新 `↻`、右侧 `›`、quote `→`；原本 emoji 保留其源形式，业务仍按实际数组 index 和 available 判断 |
| 页底 | 原固定生成 tray，白82%／blur-xl、横 16、上 12、下 32；主按钮 py 14／px 24／全圆角，左 Material `arrow_back_ios_new` 22；gradient `#004cc8 → #1D64F2 → #5856D6` | 当前 `.sticky-actions` 为 sticky、padding 17／29／18 rpx（8.5／14.5／9）；左 `‹`；IDEA 已由 JS 隐藏 Tab，底 offset 使用 safe area。source fixed 与当前 sticky 是布局差距，不能算同实现；既有手动入口需保留为明确 R1 增补 |

源 primary button 的 `h-13` 没有在 HTML 自定义 spacing 中声明，Tailwind v3 默认也没有该项；**不能写“原按钮固定 52 px”**。明确可用的是 padding／line-height 等实际 token。PG01 的 `h-84` 同样不能直接猜成 336 px。对未生效 utility 应记录原类、实际由其他规则决定的尺寸及后续运行值，不能把猜测作为一比一证据。

IDEA 非系统图形名称为 `arrow_back_ios_new`、`drafts`、`person`、`auto_awesome`、`send`、`cached`、`arrow_forward_ios`、`trending_flat`；其中 `arrow_back_ios_new` 在返回／文案／主按钮颜色尺寸不同。脚本演示还有 `sync`／`check_circle`，不是当前真实异步状态必须新增的假成功终态。状态栏的 signal／wifi／battery 由微信提供。

可复用已固定来源 Material 流程和现有 glyph：如 `pages/about/assets/material-symbols-sources.json`、`pages/city/assets/material-symbols-sources.json` 和 activity 分包清单。**先核对应 outlined／weight／FILL／opsz 再复制／着色**；city `auto_awesome`／`location_on` 有 FILL=1 版本，不可仅按名称拿来当原 default outline。本次未做这些新 glyph 来源下载或字体一致性验证；新资产 owner 应记录精确来源、axes、path hash、允许的变换与颜色，font proof 留 docs，app 只装页内 SVG，避免扩大主包字体。

### 已有动作与状态必须保留

- `headerActionInsets()` 已按真实 menu rect 计算 `profile/draft`，原逻辑没有必要重写；源 32 px 个人圆恢复后，当前 draft = profile inset + 34 px 仅剩 2 px 间距，原稿 gap 8。若改图形尺寸导致间距不足，需先用实际几何确认，再单列最小 offset 调整，不能连带改业务。
- 草稿→`openDrafts`→首页真实 drafts intent；个人→me；返回按 REVIEW→FORM、FORM→IDEA／本人活动区、IDEA→本人活动区分流。保留这些真实目的地。
- 灵感选择／轮换已有绑定；其他类别 `available === false` 显示未开放，并且不修改当前羽毛球草稿。不能复刻原网页假的“所有类别可生成”演示。
- 两生成按钮→同一个 `suggest`→`POST /events/drafts:suggest-local`，带身份／重放／超时保护，成功后 FORM 显示字段来源；手动→`openForm`；慢请求取消→`cancelSuggestion`。原 JS 1200 ms 假策划成功不能接入。
- 当前“本地构思／规则提取／发布前确认”、外部 AI 未开放的真实说明继续显示，原“剩下的交给 AI”不能成为能力承诺。

`.page-header`、`.primary-button`、`.count`、`.chevron` 等在 FORM／REVIEW 复用。所有新尺寸限定 `.stage-IDEA` 或 IDEA 专有组件；不将 IDEA 圆角、fixed tray 或 glyph 替换作用于表单预览、重大变更确认和发布按钮。快捷日期／场地声明／费用／保存／发布业务没有新变化时，不重跑其整个矩阵。

## C：普通羽毛球访客详情 PG01

完整原 HTML 已读；视觉范围 `pg01/code.html:117–406`。当前 `event.wxml:1,39–72,315`、`event.wxss:144–197,470,592–649` 是主要相关区域；读了先前规则和后置 live 覆盖。当前 `.poster`／`.detail-section` 是全局选择器，直接改它们会影响其他状态；本批必须先建立状态 scope，再恢复原组件。

| 位置 | 原稿明确值／结构 | 当前源码及差距 |
| --- | --- | --- |
| 海报比例／背景 | 满宽，max 425，窄屏 aspect 4/4.8；`#0A52DF → #026BFB → #00CEFE`，18 × 18 点阵、径向光；源两条 SVG 轨迹 | 高 850 rpx（425 px，375 宽时应为 450），gradient 160°／不同色；无原点阵，`:after` 边框虚线代替源曲线路径 |
| 球拍／皇冠／运动员 | 原球拍完整 SVG：椭圆＋网线＋手柄；皇冠 inline path／32／-12°／yellow；运动员原宽 256、top 48、right -24／-3°，`h-84` 未定义 | 球拍是 `.poster-court` CSS 圆边框；皇冠文本 `♛`、54 rpx（27）／-18°；运动员 735 × 510 rpx（367.5 × 255）、top 63 rpx（31.5），层级／裁切不同。不能以文字皇冠称同源 |
| 海报文字与贴纸 | headline 主 42／次 50、-2.5°；tagline 主贴白／padding 6 × 12／-1°；右 badge border 2.5／padding 10 × 14／radius 16 | 主 76／次 85 rpx（38／42.5）／-3°；tagline 阴影额外 lime 实色；badge radius 30 rpx（15），padding 17 × 11 rpx（8.5 × 5.5）；恢复源图层和明确旋转，字体实际加载留独立边界 |
| 导航 | 三个圆 hit box 36，返回 glyph 20／stroke 2.5，分享 16／stroke 2.2，更多 20 原 circles；dark glass alpha38%／border alpha20% | hit box 60 rpx（30）；`‹`／`↥`／`···`；当前固定右留白 210 rpx（105），没有读取 menu rect，恢复按钮大小后需 root 明确实际胶囊适配 |
| 白 sheet | overlap -24、radius 32、左右 20／上 20／下 32；标题 22；标题区底 border／padding-bottom 20 | margin -46 rpx（-23）／radius 58 rpx（29）；左右 40 rpx（20）已接近；上 43 rpx（21.5），后置下 27 rpx（13.5）；标题区无原独立完整 border／pb20。部分接近值不要无理由重做 |
| 时间／地点 | 40 px icon box／radius16、glyph20 Material；行 gap14、两行区域 gap16；地点 text max215；导航是原原型 toast | 当前 box73 rpx（36.5）／radius26 rpx（13），字符 `▣`／`⌖`；通用行 gap18 rpx（9），有额外“活动时间／场地地点”label。真实地点复制要留，其按钮可以复原视觉，但不能改称真实地图导航 |
| 主办／费用／成员 | 主办卡 padding14／radius16，avatar48／彩色halo2；其后 meta 区有上 border、compact two-column 水平／费用行，seat 行原 SVG groups16／avatars24 | 当前主办卡 padding22 rpx（11）／radius26 rpx（13），avatar68 rpx（34）＋lime边；费用和席位放在主办卡之前的大 icon-row。源 Léo／16人／照片是示例；需恢复视觉层级同时继续用实际 hostAlias、stats、已授权昵称 |
| 页底 | 横20／上14／下32、gap12；join py14／px24／15字级，分享 py14／px20、原share glyph16 | 横40 rpx（20）已接近；上17 rpx（8.5）／下18 rpx（9）＋safe、gap16 rpx（8）；button padding14 × 11 rpx（7 × 5.5），文本 `↥`。报名/复制真实能力及状态控制继续保留 |

该 HTML 全页 15 个 inline SVG 和两个 Material 名称 `calendar_today`／`location_on`，SVG 数量包含模拟状态栏，不能都计入新页面资源。优先精确提取轨迹、球拍、皇冠、返回、分享、更多、host／seat chevron 和元信息的 heart／money／groups 原 path、stroke、dash、linecap、fill／opacity；同一分享／chevron 可复用准确同几何变体。Material 仅两图按原 outlined 轴值与 FILL 核对，不能用发现页 Phosphor calendar/map-pin 替代。

当前运动员图片 `/assets/stitch/pg01_badminton_player.jpg` 为 36,028 B、512 × 279、SHA-256 `9d3ffba93e70736ff1d8d72c3f8387e2a7f3e4fafca6c0a9f56b1be2fb03db88`，本批建议保持字节复用。它是示意资产，不能成为本场运动员／已报名者真实照片。本次没有向远程原图 URL 请求或重新验证该 JPG 的原始下载／裁切来源，不能凭文件名承诺照片像素与网页完全相同。

### 已有跳转／数据，不改成原网页假成功

- 返回 `goBack`：先关闭确认／成功态，分区退回详情，否则 navigateBack，失败回首页。
- 顶部／底部分享 `shareCurrentEvent`：主办进入有资格校验的邀请卡；普通访客复制当前安全活动信息；AA 分区复制当前账本摘要。源按钮可恢复图形，但访客标签继续说明真实复制行为。
- 更多 `openEventActions`：举报／求助和复制安全信息，有 actor／event／version／refresh 回调保护；不能换成原 toast “更多设置”。
- 地点 `copyVenue`：同 ID 当前 payload city＋venueName，未知场地如实提示；没有源稿真实地图能力，不新增 `去导航` 假动作。
- 主办卡／席位／成员与详情分区 `jumpToSection`：按 `sectionAvailable` 校验能力，路由仍是同活动；原“发起人主页”不是当前已有功能，不把 source Léo 当真实个人页。
- 报名只有原 `joinButton` 条件满足才进 `openJoinConfirmation`；确认已有版本／身份／席位服务端保护。满员／暂停／过期等当前分支保留，不能照原 JS `isJoined = !isJoined`／attendeesCount++ 模拟成功。

源标签点击只是原型换色，不是 R1 搜索接口；当前标签实际 visibility／city／skill 使用服务端事实。真实场地依据、取消规则、风险暂停、审核版本、安全与举报入口均在原稿之外，是必须保留的业务增补。建议把它们维持独立次级说明区，不能以追求同图为由删掉。不改变报名／审批／签到／账本／邀请／身份代码；成功卡与 live/detail/section 现有行为和图层继续隔离。

## 独占写入与 root 后续有限验收建议

| owner | 独占写入 | 一次 freeze 时交回 | root 后续只检查与改动相符的路径 |
| --- | --- | --- | --- |
| A | `pages/messages/messages.wxml/.wxss`、`pages/messages/assets/`、消息独立 evidence | 2 个原 SVG 的源行／hash／路径证明；有效 INBOX CSS；CENTER/CHAT 未受影响；JS 与绑定字节／语义保留 | 胶囊／三筛选；搜索开关；优先“全部”→CENTER→返回；一条现有真实通知同 ID；设置焦点。读取通知会改变已读，应沿用受控身份并记录 |
| B | `pages/create/create.wxml/.wxss`、`pages/create/assets/`、构思独立 evidence；有明确几何证据时才单列 helper offset 差异 | 源 token／orb CSS 图形；Material 来源／axes／FILL／hash；仅 IDEA 覆盖；无 FORM/REVIEW 绑定变化 | 实际胶囊／输入卡／底部tray可见；一条羽毛球灵感填入＋轮换；关闭类别不改输入；手动 FORM往返、草稿／个人现有入口。JS未改生成不重跑发布／日期矩阵 |
| C | `pages/event/event.wxml/.wxss`、`pages/event/assets/`、普通详情独立 evidence；必要时仅 native header 几何字段 | 普通状态 scope与所有排除态；源 SVG child/path 准确证据；2 Material 轴值；JPEG字节保留；数据／条件／binding不变 | 一条现有可访问访客羽毛球同 ID；海报/white sheet/底部尺寸；复制地点／活动信息；更多菜单、成员；打开／取消报名确认。仅回看 host/member/success/一既有分区确认样式不串，未改业务不新报名／发布／费用写入 |

root 统一源码同步、必要编译／包体检查、窄范围模拟器／可用时 native UI、独立 source reviewer、提交和 GitHub 上传。新字体文件不进入主包；不能借并发各 owner 导入重复 font。无需全量测试、全量业务矩阵或自动 CI。若仅静态样式／glyph 修改，冻结前仅做一次有意义的源／资源／绑定检查；具体失败或代码变化出现后再补相关检查。

## 读盘快照（本文件产出时）

| 页面 | 文件 | 字节 | SHA-256 |
| --- | --- | --- | --- |
| messages | `messages.wxml` | 21,031 | `813ad07608244bd699be8b4053ac0d3b630790f72207bac53c8626be54bb5cc8` |
| messages | `messages.wxss` | 28,676 | `d7f5eb1d60c43aba966ff87e2967af26ec6a87d5149435cfc953a4d8afb2b058` |
| messages | `messages.js` | 30,759 | `799d2a61281dbb9ffceca63d2fe86a467201ef6de88543c40887ecfd1f2de1e3` |
| create | `create.wxml` | 27,400 | `47d83c021cbc6ae74b31162c36c2c1f3eb76cdce1431ae490e37bae81565ff95` |
| create | `create.wxss` | 19,819 | `8d3681482c5f41c4665eaa67e65b675484a8c41d88bb4ad0240e6ad7f8d5094a` |
| create | `create.js` | 39,839 | `23257bc0590551c7c507f0bc83fa73881051cb8e8a415e8bb7600bfef7ca8118` |
| event | `event.wxml` | 75,442 | `92da3fc366ce0b32863cfb82f2ae1e310482e27ca168a2db21bdc2e33f51c276` |
| event | `event.wxss` | 86,849 | `426a994e9c6538aa99685d0bf060616bbeef29fe16dc4b2c93a284305ebbc008` |
| event | `event.js` | 103,484 | `511d72c878c18d391304523180ea6baae8151322bbc59a73490c0ba385b01a4d` |

这九个 hash 是只读快照，不是提交头或新的测试结果。三个核心组件完成也不能等于三条整路由完成，更不能等于 ZIP 39 个屏／状态的逐像素验收。字体实际加载／渲染、未盘点长页状态、真机、正式 AppID、HTTPS 合法域名、订阅消息、真人运营和三场受控活动继续分别未验。
