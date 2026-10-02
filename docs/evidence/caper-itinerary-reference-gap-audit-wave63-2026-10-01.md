# `_1` 我的行程原稿差距审计（Wave 63，2026-10-01）

本报告为独立只读审计。已完整阅读原稿 `code.html`（169行）、用 `view_image` 查看原稿 `screen.png`，并完整核对现有 `itinerary.wxml`、`itinerary.wxss`、`itinerary.js`。同时查看已有 Wave 56 行程截图及 Wave 57 定向证据，以区分已完成项和本批差距。只新增本报告；未修改产品、Git、模拟器或测试，未编译、下载或运行全量测试。根代理另行负责 Wave 62 发布。

## 来源、换算与快照

- 原稿：`/private/tmp/irl-stitch-original/stitch_design_system_generator/_1/code.html`、`screen.png`；原PNG为 **561×1600**。
- 当前：`miniprogram/subpackages/activity/itinerary/itinerary.{wxml,wxss,js}`，路由 `/subpackages/activity/itinerary/itinerary`。
- 旧截图：`docs/evidence/images/caper-itinerary-current-wave56-2026-10-01.png`，**580×1260**。仅作为已存视觉上下文，不是本轮模拟器证据。
- 下表原稿尺寸取HTML的明确token，不能把561px宽导出长图直接量作375px设备CSS距离。当前rpx统一按 **375px窗口，2rpx=1px** 换算；其他窗口需按 `rpx × viewportWidth / 750`，本轮未读取运行时布局。

| 文件 | SHA-256 |
|---|---|
| 原 `_1/code.html` | `7fd05770991f1772cac4b01eb3d8d2f3bd18051dd5b85bb2be319bb1ac5bea58` |
| 原 `_1/screen.png` | `a0ce3c1933e3c884b13d0ca75c3d301565d66bf284116183f10e773ec7f4743e` |
| 当前 WXML | `89adc62904b9652fa2416601d9c696850064228a2e5fbfb14bdd21c8f1aba05a` |
| 当前 WXSS | `31023470a60b78a2e734ada0faa62345d30307b3e19c058a09bfb21e5b7f42b0` |
| 当前 JS | `11a0807e6fa4882e81a268aea9f4149f94e5b6204dc758cb715b2c66d1b764f6` |

实现前应重读这三个产品文件并核hash，避免并发修改后使用本审计旧快照。

## 已完成项与数据边界

现 `.featured-cover` 为352rpx，375px下 **176px**，已对应原 `h-44`。Wave 56 已将蓝色个人入口中的棋子替代为白色人形轮廓，并把后续状态徽标改为胶囊形；现源码可见 `.profile-glyph` 和 `.later-state { border-radius:999rpx }`，不要重复列为未做项目。Wave 57 已存证首卡按上海自然日显示“明天开始”及个人入口实点进入 `pages/me/me`；本轮未重跑这些操作，也不将既有证据扩大为所有后续卡或真机验证。

本页真实数据来自 `/me/events`，只保留符合当前身份的已确认报名／本人主办且未取消、过期、完成的近期活动，按 `startAt` 排序。上海日期、跨日结束时间、费用上限、主办审核状态、身份切换清空及三种详情分区入口均由现JS处理。视觉恢复不需要改JS。

原稿的固定“周六一起打羽毛球”、12月14日、48小时、上海场地、¥30–50、6/6满员、Luna/Alex/Momo队友、`IRL-PASS-88219` 和“日历已自动同步”均是静态样本，不能成为当前API事实。保留 `featured.title/dateLabel/timeLabel/locationLabel/feeLabel/stateLabel` 和后续真实 `item` 字段；保留**真实报名、签到、详情按钮**及“本页未同步系统日历，也不生成永久入场凭证”说明。原头像堆叠不应使用样本人名填充。本页不会因视觉对照获得系统日历或永久通行证能力。

## 主卡：可直接修改的几何与字级

| 项／当前 selector（WXSS行） | 原HTML（行）与明确目标 | 当前375px | 建议rpx值／补充 |
|---|---|---|---|
| 主标题 `.featured-title`（26） | `headline-md`（42）：**20px / 26px / 700**，letter-spacing −0.015em | 16.5px / 21.45px / 800 | **40rpx / 52rpx / 700**，letter-spacing −0.015em |
| 副标题 `.featured-subtitle`（27） | `body-sm`（45）：**13px / 18px / 400**，`#424655`；标题到副字4px | 10.5px / 14.7px，margin-top3.5px，margin-bottom11.5px | **26rpx / 36rpx / 400**；标题副字gap8rpx，副字块到facts24rpx |
| 主体padding `.featured-body`（25） | `p-space-lg`（39）：**16px**；各内容组gap12px | top14.5px、左右/bottom15px | **32rpx**；现功能按钮作为额外真实内容保留 |
| facts容器 `.facts`（28） | `p-space-md`／`rounded-xl`（48）：**12px padding / 12px radius**；三行gap10px | padding9px×10px；radius12px | padding **24rpx**；radius24rpx已经对齐；容器列gap20rpx |
| facts行 `.fact-row`（29） | `gap-2.5`（50/60/70）：**10px**；源行没有独立上下padding | gap8px、上下padding4px | gap **20rpx**，去行上下padding后由父gap20rpx控制，避免双算 |
| 三行主字 `.fact-row > view:last-child > view`（29/31） | `label-md`（55/65/75）：**13px / 16px / 600**，`#1a1b1f` | 11.5px / 15.525px / 700 | **26rpx / 32rpx / 600** |
| 日期副字（32，当前三行共用） | `label-sm`（56）：**11px / 14px / 700**，`#424655`；源主副字无独立margin | 9.5px / 12.825px / 400，margin-top2px | 日期副字单独 **22rpx / 28rpx / 700**；不要把三行副字全改11px |
| 地点／费用副字（32） | `body-sm`（66/76）：**13px / 18px / 400**，`#424655` | 9.5px / 12.825px / 400，margin-top2px | **26rpx / 36rpx / 400**；源两项的字级大于日期提示 |
| 图标盒 `.fact-icon`（33） | `w-7 h-7 rounded-lg`（51/61/71）：**28×28px / radius8px**；内部官方glyph18px | 23×23px / radius6.5px，Unicode字13.5px | **56×56rpx / radius16rpx**，`image` **36×36rpx**、aspectFit、flex-shrink:0 |
| 报名状态标题 `.attendance-heading`（36/37） | `label-sm`（83/84）：**11px / 14px**，左w700、右w600；右green `#34C759` | 10px，无明确line-height；右`#1eae53`/w700 | **22rpx / 28rpx**，恢复原green；保持真实`stateLabel` |
| 场地提示 `.venue-note`（42/43） | `p-3 gap-2 rounded-xl`（108）：**p12px / gap8px / radius12px**；背景`#e9e7ed` 60%；图18px上移2px；正文13px、`leading-relaxed`=1.625 | p10.5px / gap7px / radius10.5px；背景`#f4f3f8`；图字符12.5px；正文10px / 15.5px | **p24rpx / gap16rpx / radius24rpx**；背景rgba(233,231,237,.6)；info36rpx、margin-top4rpx；正文26rpx、line-height1.625（21.125px） |
| 主卡外形 `.featured-card`（19） | `rounded-2xl`（21）：radius16px；双shadow `0 4px 24px -4px rgba(28,41,61,.08), 0 1px 4px 0 rgba(28,41,61,.03)` | radius16px已对齐；单shadow0 4px 15px alpha.08 | radius保持32rpx；shadow **0 8rpx 48rpx -8rpx rgba(...,.08),0 2rpx 8rpx 0 rgba(...,.03)** |

日期主行变大后，真实“月 日（周x）+起止时间”可能比样本更长。保持正文 `min-width:0`、有效换行与布局伸缩，不缩回字级或写死样本日期以凑宽度。

## 白色图下渐变与两枚封面徽标

原 `code.html:26` 是 `bg-gradient-to-t from-surface-card via-on-surface/20 to-transparent`：从**底部不透明白色 `#ffffff`**，经中段 `rgba(26,27,31,.20)`，到上方透明。当前 `.cover-shade` 为 `linear-gradient(0deg,rgba(255,255,255,.48),rgba(26,27,31,.05) 48%,transparent)`，底白和中段暗色均偏弱；旧Wave56截图中图片底边仍明显带图像颜色，原长图底边与白色主体更连续。建议按原语义 `linear-gradient(to top,#ffffff 0%,rgba(26,27,31,.20) 50%,transparent 100%)`。不改变176px图片盒及真实`featured.cover`类别选择。

| selector | 原HTML目标 | 当前375px | 建议 |
|---|---|---|---|
| `.countdown`（23）、WXML13 | left/top **12px**，padding **4px×12px**，gap6px；文字 **13px/16px/w600**；pink-soft/party-pink；`timer`16px/F1 | left/top12px已对齐；padding4px×10px；文字11px/w750；字符`◉` | 保持24rpx位置，padding8rpx 24rpx，inline-flex/gap12rpx，文字26/32rpx/w600；官方timer32rpx/F1 |
| `.real-event-badge`（24）、WXML13 | right/bottom **12px**，padding **4px×10px**，gap4px；文字 **11px/14px/w700**；white90%；`verified`15px/F0 primary | right10px/bottom9.5px，p3.5px×9px；文字9.5px；white93%；字符`✓` | right/bottom24rpx，p8rpx 20rpx，gap8rpx；文字22/28rpx；white90%；官方verified30rpx；**仍写“本人活动”，不恢复PASS编号** |

原二徽标还有backdrop-blur与小阴影。若目标微信运行时不支持blur，按实际渲染报告；本审计未取得该兼容性证据。

## Material符号：必须保留原名、FILL、颜色和显示尺寸

原字体族为 **Material Symbols Outlined**。F0为span未明确覆写FILL的默认0，F1为源明确`font-variation-settings:'FILL' 1`。这里的px是CSS布局框／字号，不是SVG path像素包围盒。不能用 `event`、`schedule`、`pin_drop`、`paid` 等近义名替代原名。

| 源HTML行 | 精确原名 | FILL | 源token → 色值 | 源显示px / 对应rpx | 当前差距／处理 |
|---|---|---|---|---|---|
| 29 | `timer` | **1** | `party-pink` → `#FF2D55` | **16 / 32** | countdown字符`◉`；必须使用fill1，不能使用F0变体 |
| 34 | `verified` | 0 | `primary` → `#004cc8` | **15 / 30** | 本人活动徽标字符`✓`；仅装饰恢复，仍无PASS |
| 52 | `calendar_today` | 0 | `electric-blue` → `#1D64F2` | **18 / 36** | 日期字符`▣`；盒`#EBF2FE`、28px/r8 |
| 62 | `location_on` | 0 | `tertiary` → `#4d5d00` | **18 / 36** | 地点字符`⌖`；盒`#F3FEE7`、28px/r8 |
| 72 | `payments` | 0 | `party-violet` → `#5856D6` | **18 / 36** | 费用字符`▤`；盒`#F2F1FD`、28px/r8 |
| 109 | `info` | 0 | `on-surface-variant` → `#424655` | **18 / 36** | 场地提示字符`ⓘ`；原无独立彩色盒，顶部margin2px |
| 154 | `check_circle` | **1** | `status-active-green` → `#34C759` | **20 / 40** | 原日历同步横幅。当前truth-mark字符`✓`；若仅恢复其装饰及几何，保留本人活动说明和未同步文本，不能恢复原状态承诺 |
| 10 | `arrow_back_ios_new` | 0 | `on-surface` → `#1a1b1f` | 22 / 44 | 完整源inventory；现返回字符`‹`，本批优先主卡/后续列表，不占用Wave56已完成项额度 |
| 10 | `person` | 0 | `on-primary` → `#ffffff` | 18 / 36 | 完整源inventory；现Wave56白色CSS人形及真实goProfile已完成，不要求本批重做 |

source仅 **9枚静态Material span、9个名字**；本批主卡明确需替换的为前6枚，后3枚按表中边界单列。现6枚字符不是官方glyph，即使语义接近也不能标为原图恢复完成。

资源可沿用现工程已经采用的 `/private/tmp/irl-material-symbols-wave60/export_symbol.py`：固定官方commit `bd8cb85bd4bad964fe6918f79665bb40c3a8efef`，路径 `symbols/web/<exact-name>/materialsymbolsoutlined/<exact-name>[_fill1]_24px.svg`，只改SVG根fill、保留path。建议本页资源放 `miniprogram/subpackages/activity/itinerary/assets/`，使用本分包本页路径，不让活动分包引用个人分包专属assets。manifest逐项记录原名、FILL、颜色、源URL、源与资产SHA-256；Apache许可复用 `docs/licenses/material-symbols-Apache-2.0.txt`。本轮未下载这6个名字，也未宣称固定commit都可导出；若缺精确原名再走官方字体提取。现 `export_font_symbol.py` 输出限制在个人分包，不能直接用于本活动页，需要根代理先明确调整本次临时helper的目标范围。

## 后续排程：可直接修改的卡片表

原两张卡 `code.html:123–149` 的相同几何不能随当前真实文字压缩。保留当前 `button` 与真实`data-id`/`bindtap="openEvent"`。

| 项／当前selector（WXSS行） | 原稿目标 | 当前375px | 建议rpx／处理 |
|---|---|---|---|
| 小节标题 `.later-heading text:first-child`（47） | **17px / 22px / 600**，`#1a1b1f` | 14px / w750 | **34 / 44rpx / 600** |
| 排序副字 `.later-heading text:last-child`（48） | **11px / 14px / 700**，`#424655` | 9.5px、`#737687` | **22 / 28rpx / 700**、原色 |
| 小节标题左右内缩（46） | 源`px-1`=**4px**，与列表首卡gap8px；主卡至本小节16px外gap+4px pt | 左右3px、top18px/bottom8px | 左右8rpx；首卡gap16rpx，外gap32rpx+pt8rpx分开控制 |
| `.later-card` padding/gap/radius（49） | **12px / 12px / 16px**；两卡gap8px | p9.5px×10.5px / gap9px / radius13px；margin-bottom7px | **p24rpx / gap24rpx / radius32rpx**；卡间16rpx |
| `.later-card` shadow（49） | `0 2px 12px -2px rgba(28,41,61,.04)` | `0 1.5px 6.5px rgba(...,.035)` | **0 4rpx 24rpx -4rpx rgba(...,.04)** |
| `.later-date`（50） | **48×48px / radius12px** | 46×45px / radius9.5px | **96×96rpx / radius24rpx** |
| 月份 `.later-date text:first-child`（51） | **10px / 12.5px / 700** (`leading-tight`) | 9px，无line-height | **20rpx / 1.25 / 700** |
| 日期 `.later-date text:last-child`（52） | **17px / 17px / 800** (`leading-none`) | 15.5px / 17.825px / 800 | **34rpx / 1 / 800**；继续真实`item.dayLabel` |
| `.later-title text:first-child`（56） | **17px / 22px / 600** (`headline-sm`) | 12px / w750 | **34 / 44rpx / 600**，保持truncate/min-width:0 |
| `.later-title`标题到状态gap（55） | `gap-2`=**8px** | 3.5px | **16rpx** |
| `.later-detail`（58） | **13px / 18px / 400**，`#424655`；标题行到说明2px | 9.5px，无line-height；margin-top2.5px | **26 / 36rpx / 400**；margin-top4rpx |
| `.later-state`（57） | **11px / 14px / 700**，padding **2px×8px**，胶囊 | 8px；p1.5px×4px；胶囊已完成 | **22 / 28rpx / 700**，p4rpx 16rpx；保留既有圆角 |
| 日期盒色 | 源第1pink-soft`#FFF0F3`/pink`#FF2D55`，第2violet-soft`#F2F1FD`/violet`#5856D6` | 两组颜色值均已有；现通过`.later-card:nth-child(2n)`选择 | 若做精确交替，应以`wx:for`索引绑定同两组色；当前伪类受列表前兄弟元素影响，本轮未跑后续双卡，不能确认第1/第2运行时色序 |
| 状态色 | 源第1“待成局”container`#efedf3`/variant`#424655`，第2“预约备忘”blue-soft`#EBF2FE`/blue`#1D64F2` | 当前全部浅蓝/blue | 原“待成局/预约备忘”没有对应当前真实状态枚举。**不能依行号替换状态文字或硬映射样本状态**；暂保留真实状态色，若另作真实枚举色映射须单独决定与记录 |

当前后续卡另有 `›`（`.later-chevron`），原稿两卡没有箭头；这是现详情入口的导航提示适配，现卡整面可点击。可以单列此差异，但不能通过删掉`openEvent`消除功能差异。真实主办状态可能比原两字胶囊长，保留`flex:none`且主标题可truncate，不把未确认报名画成已成局。

## 次要字级／真实说明容器

主卡与后续卡完成后，可按原明确token补以下细节；不要回头重做已存证的自然日与个人路由。

| 项 | 原稿 | 当前375px | 可恢复值 |
|---|---|---|---|
| 顶部intro绿pill | 11px/14px/w700，p4px×10px，gap6px、绿点6px | 10px；p4px×10px、gap5px、点5.5px | 字22/28rpx、gap12rpx、点12rpx；保持真实“已参与与我组织的活动” |
| intro标题 | 22px/28px/w700；前后stack gap4px | 21.5px/27.95px/w800，margin-top9px | 44/56rpx/w700；不要恢复“实时同步”承诺 |
| intro说明 | 13px/18px/w400 | 11.5px/17.25px | 26/36rpx/w400，保留核对活动事实的现文案 |
| truth-note容器 | 原同步横幅p12px/radius16px/gap12px；32px白圆中20px F1绿check_circle；title13px/16px/w600；正文13px、leading-relaxed1.625 | p11px/radius12px/gap7px；24px圆中14px字符；title10.5px/w700；正文9.5px/14.25px | p24rpx/radius32rpx/gap24rpx、64rpx圆/40rpx图、title26/32rpx/w600、正文26rpx/1.625；**全部现未同步／无永久凭证说明保留** |
| footer文字 | 13px/16px/w600，outline`#737687` | 10px/w650，`#858998` | 26/32rpx/w600、原色，保持现事实表达 |

源顶部56px网页导航、44px返回触区与本页49px微信导航、原生胶囊预留形成平台适配差距。本批优先主卡及后续列表；不得为拷贝网页顶栏占满宽度而删掉本页胶囊避让。person CSS轮廓并非官方原glyph完全等同，既有Wave56完成结论是白色人形与实际入口，不是整头部逐像素验收。

## 建议最小实施与验证范围

1. 主卡WXML只将6个字符换为本页官方同名SVG，并为日期副字与地点/费用副字分开class；保留`data-id`、全部bindtap、所有真实字段和条件。WXSS按主卡表恢复20px标题、13px主字、11px日期提示、28px图盒、18pxglyph、白色下渐变及徽标尺寸。
2. 后续卡按12px padding、48px日期盒、17px标题、13px说明、11px状态pill恢复；状态文字与JS不变。如果采用索引色序只在WXML绑定现已有两组装饰色，不用样本状态替代真实枚举。
3. 独立静态复核本地引用、manifest hash、SVG/XML、原名/FILL/token/path；本批继续保留 `itinerary.js` hash。根代理占用模拟器前先协调，随后仅定向检查本人真实首卡、至少两张后续卡、长标题/状态胶囊、375px布局及报名/签到/详情返回路径。
4. 可复用现有 `test/miniprogram-itinerary.test.ts`，其既有用例覆盖本人筛选、上海自然日、跨年、参考羽毛球封面、主办审核、旧身份拒绝及三种不同分区导航。本轮只读了用例，没有运行；视觉可逆修改不需新增镜像测试，也不需全量测试。编译、定向运行和真机结果需由实际执行者另记，不可从本审计或旧Wave57证据推定。

本审计给出的可实施差距是源码与原HTML之间的明确值，不是产品已改、编译已通过或整页已逐像素一致的结论。真实按钮及说明比静态原稿多，整体卡高和整页长图不应硬凑原样本高度。
