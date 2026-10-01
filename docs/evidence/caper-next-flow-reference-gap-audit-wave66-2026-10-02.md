# Wave66 下一批流程原稿与 R1 缺口盘点（只读）

日期：2026-10-02。**状态：只读审计，未实施。** 本文只盘点发起 FORM / 新草稿 REVIEW、报名确认、报名成功；不恢复页面、不写资源、不改产品、他人证据、总矩阵、Git 或微信，不运行测试或全量检查。完整 HTML 与完整 PNG 已逐页读取/查看；以下是源代码、ZIP 和当前本地业务的对照，不是微信视觉、业务验收或真机证明。PG01 C 在独立审查两处字号/行高订正后保持冻结。

## 1. ZIP 实际代号与完整来源

ZIP：`/Users/tsb/Downloads/stitch_design_system_generator (2).zip`，24668856 B，SHA-256 `df22e733d33fda20979b75b8a7bc94717c4a5c9e41561a54e3038432fab32603`，39 份完整 `code.html`。根目录为 `stitch_design_system_generator/`。下列全部 HTML / PNG 已与对应 ZIP entry 逐字节比对一致。

| 用户流程名称 | ZIP 实际目录 | 原页面 | 当前分支 |
| --- | --- | --- | --- |
| 发起 FORM | `caper_ai` | 耍起 CAPER · AI 建局 | `create stage === 'FORM'` |
| 草稿确认 | `pg04` | PG04 草稿确认 - Project IRL | `create stage === 'REVIEW' && publishPreview` |
| 报名确认 | `pg05` | 报名确认 - 周六一起打羽毛球 | `event joinConfirmation` |
| 报名成功 | `pg05_s` | Registration Success | `event successState === 'JOINED'` |

**FORM 不在 pg04。** `pg04_s` 是发布成功，不是 FORM 或报名成功，本次不纳入盘点。IDEA 原稿 `pg03_ai` 与 C 访客 `pg01` 仍属于已冻结本批，不重画。

本地完整来源：`/private/tmp/irl-stitch-original/stitch_design_system_generator/`。

| 完整来源路径（相对上述根） | bytes | 完整度 / PNG 尺寸 | SHA-256 |
| --- | ---: | --- | --- |
| `caper_ai/code.html` | 43225 | 740 lines | `baa9cbbb84c513529e4df1f7efdaec4057a9585993242983565fd58d5b461628` |
| `caper_ai/screen.png` | 200437 | 238×1600 | `233c1db76acebe257d35350c33b5c8bae5ebf435a02f09b90b945072d2153dd5` |
| `pg04/code.html` | 15626 | 344 lines | `d61b1b9d6d221cf03ef4ab9d1c8218ea004e2594ce3638f95a35dfbf7f43f2a7` |
| `pg04/screen.png` | 265612 | 780×1704 | `9df8eb1764604bd81f7ecc6f5d2125a9f0ff4ec07e2056b9ad45dd3a40b65bb3` |
| `pg05/code.html` | 17811 | 343 lines | `a016c7725aebb5eeb0ceaad0664651f723a78459738b049fc4c51fa652ac0075` |
| `pg05/screen.png` | 386681 | 647×1600 | `96167d34204721512ade34dedf01313894b09b68147865b5a104015a3679d63b` |
| `pg05_s/code.html` | 26407 | 382 lines | `cc462e2d55b767cac1abae42cae61ff796dafbdb265941538d908f9d39dafd27` |
| `pg05_s/screen.png` | 295313 | 412×1600 | `01517b01a2b6438d4851f70ce262c54a05ecba9da04cf051ae643cbb50667136` |

PNG 尺寸为导出文件的像素尺寸；例如 caper_ai 的长 PNG 为238×1600，不把导出缩放后的截图坐标当 CSS px。源有效数值按16px默认 rem、Tailwind v3配置与自定义CSS还原。当前 rpx 的下列括号比较仅在375px窗口时除以2，不能把 rpx 字面值直接当源 px。

## 2. 发起 FORM：caper_ai

### 原有效几何与图形

| 源区域 | 有效 CSS px / 具体图形 | 当前差异 |
| --- | --- | --- |
| 页面 / 头 | width100%、max420，slate50；导航横16/纵10，logo32/r12/“耍”18、品牌16、CAPER12；草稿按钮p6×12/glyph14，profile32/glyph16；原模拟status40 | 当前header高96rpx（48）+真实status，品牌/按钮更小，profile用CSS轮廓、草稿用文字符号；实际capsule已有 `headerActionInsets`，后续需限定FORM适配 |
| Hero | 横20/顶16/底8，标题24/30/900；文字12/19.5；注释10/p2×10/+6°；orb64/r16、蓝眼10/绿眼10、眼gap8、深色gradient与30%30%radial、Social Copilot9 | 当前标题30rpx（15）、orb103rpx（51.5）圆角/渐变不同，眼为“●　●”；真实本地规则说明须保留 |
| 输入 / 灵感 | 卡横16/mt12/r16/p14，textarea14/22.75；toolbar pt8/mt4；voice32/glyph16、generate32/glyph14；灵感mt16/gap8，chipp8×12/r12，emoji20、主12/辅10 | 当前form-page横20rpx（10）、卡p18rpx（9）/r20rpx（10），textarea21rpx（10.5）、voice48rpx（24）、字符箭头/刷新/麦克风 |
| 活动类型 | mt20，heading14，grid6cols/gap8、square随可用宽度、r12，emoji24、标签11、selected边2/check16 | 当前固定icon88rpx（44）/gap9rpx×5rpx/标签15rpx（7.5）；源12种类型仍只作关闭状态展示 |
| 时间 / 地点 / 人数 / 费用 | 通用card横16、p16/r16、gap12–14；时间mt20，其余mt16；日期grid4/gap8/p8/r12/12主10辅；时段11/py6/r8；地点pill12/py6、district12/p4×10，输入12/py8/pl36/pr16/r12；人数button12/py8/r12；fees p10/r12/12主9辅 | 当前cardp18rpx（9）/r23rpx（11.5），各label/radio/input更小；真实起止日期、场地核实、人数上下限、本人占席、费用上限与两deadline不可删 |
| 封面 / 公开 / 主理人 | 源4cols/gap10，poster3:4/r12/p8；公开4选项、主理人avatar36、添加协办；卡p16/r16 | 当前封面为现有真实展示JPEG，不是源CSS emoji mini poster；公开/审核与同城/仅群语义不同；协办需发布后选真实成员 |
| 助手 / preview / footer | 助手p16/r16，蓝900→靛900→slate900/128光层；preview cardp12/r16/gap12、封面80/r12；底栏fixed bottom64横16/纵10/gap12，save1/3、primary2/3 py10/rfull/12字体；源tab64 | 当前preview图片91rpx（45.5）、底tray sticky bottom106rpx（53）+safe/p7×10/gap5，primary13字体/line25，源tab不能复制到公共导航 |

原 FORM 17 个 inline SVG：2模拟status、5公共tab应排除；页面内容10次SVG（箭头重复，9种几何）。原没有 Material / Phosphor。重要准确图形源行：草稿100（Heroicons盒子路径，stroke2/glyph14）、person104（stroke2/glyph16）、麦克风157（含长柄/竖向capsule，stroke2/glyph16）、生成箭头161/703（`M14 5l7 7m0 0l-7 7m7-7H3`，stroke2.5，14/16）、刷新178（双回转path，stroke2/glyph12）、更多220（`M9 5l7 7-7 7`，stroke2/glyph12）、日期345（`M8 7V3m8 4V3…`，stroke2/glyph16）、地点414（双path pin，stroke2/glyph16）、保存697（向下箭头盒子，stroke2/glyph14）。源 `viewbox` 在HTML SVG节点需按实际SVG语义识别为viewBox；不能用现有 Material 箭头/麦克风替换这些 inline path。

原类别 emoji 依次为🏸、☕、🍸、🚶、🎲、🥏、🏀、⛰️、🏋️、🎨、🍜、＋；原orb由CSS层组成，未来也不应新画位图角色。原全页无JPEG/头像请求。

### R1 字段、绑定与保护边界

`create.wxml:40–125` FORM及 `create.js:63–95, 308–432, 522–673` 已读。当前 `buildInput` 的实际字段：title/type=badminton/startAt/endAt/timeZone=Asia/Shanghai/可选templateDurationMinutes/skillLevel/city/venueName/venueStatus/minParticipants/maxParticipants/registrationDeadline/confirmationDeadline/feeMode/feeCapFen/cancellationRule/visibility/approvalMode/hostParticipates。

- `aiInput` / `suggest` / `cancelSuggestion`：300字、本地规则提取、slow/manual入口、账号及generation保护保留；源“AI自动完善、自动匹配海报、优化参与率”不能被实现为模型或网络成功。
- `chooseQuickDate` / `setStartDate/Time` / `setEndDate/Time`：真实动态本周末及duration/用户改结束时间、日期变化撤销场地核实。源固定3月23、24不复制。
- `chooseQuickCity` 为五城市；当前无室内/外偏好、浦东district、时间投票和参与对象筛选字段。源组件只可在已授权关闭状态表现，不能增加假持久化。
- `setVenueConfirmed`、`setHostParticipates`、`chooseParticipantRange`、AA上限、取消规则、报名前30分/成局前90分默认及custom deadlines必须完整保留。源“已预订”、5号馆和免费并非服务端事实。
- `setVisibility` 仅INVITE/PUBLIC；PUBLIC强制MANUAL，`setApprovalMode`拒绝PUBLIC+AUTO。源“公开所有人可见、同城可见、仅群可见”不等于现有能力。
- `showUnavailable` 的非羽毛球、语音、20+、商家买单/收款、自定义封面保持关闭；`openCohostSetup` 新活动只提示发布后工作台，编辑已发布活动才跳hostSection。
- `saveDraftButton`、`publishPreviewButton` 及当前LOADING/ERROR/safety禁用条件保留。`saveDraft` 对draft/version/identity、`publish` 对本人是否参加、场馆时间变化重新核实、服务端draft回读完整保留。
- 后续仅新建FORM可做原稿恢复；`editingEvent` 的已发布编辑警告、读取失败重试、conflict重载、重大变更预览均属受保护分支。本轮已冻结 `stage-IDEA` 全部markup/CSS及helper、公共tab不能串改。

## 3. 新草稿 REVIEW：pg04

### 原有效几何

原画布 max400/h852、手机外框6/8、状态条、刘海、128×4home indicator是模拟壳，不进入应用。应用内容白底：nav横16/纵8；返回p6/-ml4、glyph24/stroke2；more glyph24/三圆半径2；title17/700。main横16/pb112/栈gap14。

原检查banner mt4/p14/r16/border1 `#E4DEFF`，gradient `#F0EEFF→#F4F1FF→#E9EAFF`；orb44，to-top-right `#7B51FC→#9F72FB→#51A0FE`，两眼6/top14/左右12、嘴10×4/bottom14、光点6/top6/left10/blur.4。Glow `0 4px 14px rgba(139,92,246,.45), inset 0 2px 4px rgba(255,255,255,.6)`。banner主14/700，副12/16.5；gap12/chevron16。

列表字体14/21、row py12、label gap12/glyph16/stroke1.8、右gap8/chevron14/stroke2；sport pill12/p2×8/rfull。日期、收费右值13；取消/报名截止需显示真实日期。footer原absolute bottom内壳，横20/上12/下32、gap14，save36%/primary64%、py14/rfull/15/600。应用应按实际native/status/capsule/底safe适配，不照搬固定852壳或tab高度。

当前 `.review-page` 横42rpx（21）/顶13rpx（6.5）、banner min135rpx（67.5）p9×11/r14、orb39.5、主11/副9；row min41.5/py5.5、字11、glyph字符13.5，footer横21/上9.5/gap8.5、primary比例1.7。原10行比当前更大；当前额外标题/水平/版本/取消/审核/成局截止均为真实必需内容，不以原稿10行来删字段。

### 精确图形与缺口

原共23 inline SVG，2模拟status排除；无Material/Phosphor。全部有效正文图形：

| 源行 | 准确图形 |
| --- | --- |
| 91 / 99 / 132 | back `M15 18l-6-6 6-6` stroke2；more三圆cx5/12/19 cy12 r2；banner chevron `M9 18l6-6-6-6` stroke2 |
| 144 / 162 | 类型：circle12,12r10 + `M12 6v6l4 2`；calendar rect18×18 x3y4 rx2ry2 + x8/16 y2–6 lines + y10横线 |
| 184 / 201 | pin `M12 2a8 8…`+circle3；场地court rect20×16x2y4rx2 + x12 y4–20 + circle3 |
| 219 / 234 | 场地状态circle12,12r9 + `M12 7v5l3 2`；人数circle9,7r4 + 三组双人path |
| 253 / 270 | amber500填充冠 `M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11…`；deadline circle12,12r10 + polyline `12 6 12 12 16 14` |
| 287 / 305 | payment rect20×14x2y5rx2 + y10横线；eye `M1 12s4-8 11-8 11 8 11 8…`+circle12,12r3 |
| 153/175/192/210/244/261/278/316 | 8个右chevrons，14px/stroke2，d同banner；gray300 #D1D5DB，bannergray400 #9CA3AF |

labelglyph灰700 #374151/stroke1.8，返回/more灰800 #1F2937，冠amber500 #F59E0B。上述back/banner/list chevron原根**没有viewBox**；源尺寸14/16/24与path坐标必须同时留证，不能默认补0 0 24 24并声称原始像素一致。

`create.wxml:128–148` / `.review-*` / JS `publish`、`confirmPublish` 已读。恢复范围必须是 `publishPreview` 新草稿；`changePreview` 的版本、affectedCount、material重新确认及差异最终提交受保护。`editReviewSection` 六section跳回FORM真实编辑；banner `backToForm`；`openHeaderAction` 返回编辑/我的草稿；`saveDraft` 和 `confirmPublish` 保留expectedVersion、身份/generation、字段已变退回FORM、safety规则、真实API结果跳转。不能恢复源“AI已完善”“已预订”“公开所有人可发现”或把确认发布按钮做本地假成功。原system sans不是Jakarta角色字体。

## 4. 报名确认：pg05

原max425、white。header nav横16/高44、两button36/glyph24，zinc900 #18181B（back stroke2.5：`M15 19l-7-7 7-7`；more三圆r2）。HTML另有safe-top fallback44与模拟status44，应用不可叠加两层假status。main横16/顶12/底112。

poster width100%/**aspect4/3.3**/r16/p20，gradient `#0062FF→#0052FF→#0142C8`；光层opacity.3，白192圆(-40,-40)/blur24，黄176圆(-32,-32)/blur24。上label10/12.5/800，上右Caveat11/+3°；中央disc96/border2白30%/mb4，emoji🏸36/-12°；准确shuttlecockSVG44、viewBox0 0 64 64，白90%路径 `M48 20L44 8L32 16L20 8L16 20L28 28L12 36L20 52L32 44L44 52L52 36L36 28L48 20Z`、黄色#FACC15圆32,52r6，wrapper top-28/right64/+12°。headline26/27.3/Rubik Mono One、黄色#FACC15、italic/-2°/scaleY1.05，shadow2×3 #0348D6 +4×5rgba.15。底tag12/16 p6×12/r6/-2°，signature10。

info mt16/p16/r16/border；title18/24.75/700、sporttag12/p4×10；facts mt14/gap10/13字、glyph16/zinc400 #A1A1AA/stroke2/gap10；cancelbar mt14/r12/p10，字11。options mt20/grid2/gap10/p14/r12，选中border2蓝，radio16/check10stroke3、主12/辅10/mt8。message mt20/label12/input12/p12×14/r12仅原型；footer横16/上12/gap12，cancel96/py12/r12、primaryflex，12字；safe-bottom fallback34是源CSS声明，不当微信固定34加到真实safe。模拟home bar128×4排除。

当前确认overlay `joinConfirmation` fixed/flex、原header最小88rpx（44）+status，main横30rpx（15）/顶27rpx（13.5），poster固定560rpx（280）/r14，渐变、旋转、中心disc90/emoji43、headline26等与原不同；源ratio应按宽计算，不能固定280。card31rpx（15.5）/r14，title17、rows12.5/gap9且额外rowborder；optionsmargin19/p8.5×7.5/r10/border1/最低71，footerbutton43高/r9.5/font13、cancel80/gap9。当前泛型GOOD PEOPLE分支不能被羽毛球海报覆盖。

原12SVG：2模拟status、10正文/脚本toast，准确源为back96、more104、shuttlecock139、calendar178（独立rect/lines）、pin188（双path）、groups197（与C groups相同轮廓）、money213（circle9+`M12 7v10M9 9h6a2 2 0 010 4H9`）、check224/252/337（`M5 13l4 4L19 7`、stroke3）。**money不是C dollar路径**；check不是Material字体。原固定艾/Leo/欣/周/+2字样stack不是实际报名人。

源fonts：正文system sans；Caveat700在手写注释/`Same Game, New Friends!`；Rubik Mono One在海报标题；Permanent Marker虽import并定义`.font-marker`，正文没有使用该类。已有Wave65 Caveat仅已授权节点、Jakarta400/600/700/800不代表本页Rubik或全部手写体已接入，禁止假称字体恢复完成。

### 实际 binding / 保护范围

当前 `event.wxml:8–25` / `event.js:1098–1177` 已读。`openJoinConfirmation` 仅READY/canJoin/event，保存id/version/invite token/actor/generation及真实title/date/end/location/fee/confirmed/capacity/skillLevel/cancellation/approval。

- `selectJoinChoice` 接受JOIN、或canExpressInterest时INTERESTED。后者是“不占名额，也不进入候补队列”，原“加入候补，名额释放自动递补”不能重命名或复用为INTERESTED。
- `confirmJoin` 先refresh再核actor/version/token/currentcapability；JOIN写真实registrations接受规则、INTERESTED写interests。generation、refresh失败关闭、提交中disabled与取消保护保留。
- `cancelJoin`、返回活动、footer取消使用真实cancelJoin；submitRegistration仅服务端回读CONFIRMED才设置JOINED。WAITLISTED/PENDING不显示报名成功。
- “给主办人留言”当前接口未开放，必须继续显示关闭声明；真实审批/取消规则、场地/费用核实声明、确认席位以回读为准保留。没有真实报名头像名单绑定，不能把原假人名/6/8插入。
- 后续羽毛球确认恢复限 `joinConfirmation.isBadminton`；generic确认、整个PUBLISHED/JOINED成功、C访客/host/member及其他event sections均保护。仅视觉说明不授权报名写入或业务接口变化。

## 5. 报名成功：pg05_s

原header fixed/status native-adapt目标，高56/横16，back44/glyph24，profilewrapper44/circle32/person18；title角色17/22/600。mainpt56/pb112/width100%；背景#faf8fe，body `Plus Jakarta Sans`15/21/400。原bodymin-height max884px/100dvh是画布最低高度，不据此固定手机页面。

| 源区域 | 有效 px / 准确形状 | 当前差异 |
| --- | --- | --- |
| Hero | 横16/顶24，check80圆/green#34C759/glyph42 FILL1，shadow0 8 24green.38；badges11/p4×10/+12/-12°；title22/28/700、body15/21/max320 | 当前check60、text✓、title18、copy11/17.6，badge9/+10/-10°；没有源三ambient层和confetti装饰 |
| Ticket | mt24/r16/shadow0 8 30.06；poster112/p16、blue#1D64F2→violet#5856D6、sports_tennis130白20%；title20/26；notches24/±12、divider mx20/dashed/opacity30 | 当前ticketmargin11.5/r14、headp12.5×12.5×14无112高、没有notches/源pattern，title15/20.25；真实stats与title绑定应保留 |
| Facts | core横20/上4/下20/stack16，iconbox36/r12/glyph20、gap12；label11/14，value17/22/600；calendar/地点button11/p6×12/glyph16 | 当前box25/r8、字9.5/12，buttonmin34/字10；字段可换布局，实际系统日历/复制地点不能假导航 |
| Proof | QR卡mt16/pt16/p16/r12，内部p12/r12/gap16，模拟QR64/glyph36；代码17角色、说明11 | 当前真实动态签到入口，无固定通行证；禁止写IRL-PASS-88219、把glyph当可扫QR或假凭据 |
| 社区 / 同局 / 规则 | 社区mt16/p16/r16、forum28box/18字形、主17；成员cardp16/r16、grid4/gap10、avatar44；规则p14/r12/gap10/verified28box18glyph/标题11正文13 | 当前公告问答替代群聊、真实授权昵称含候补说明、avatar31、cardp10.5/r12；源微信群/个人微信/人名/照片/余2席/转让承诺不可植入 |
| Footer | fixed横16/上12/pb-safe/gap12/max448；按钮48高/rfull/字15，flex1:1.5与share48，glyph18/22 | 当前横14/上7.5/下9+safe/gap5、字11、auto高、1:1.9与share36；current顶栏保留实际更多/分享策略与C不串样式 |

当前 `.event-page.event-success`（更高specificity）根background#f5f6fa；`.joined-success` panel为#faf8fe。后面低specificity`.event-success`不能覆盖前者，不把最后一条相似类声明当当前最终样式。当前page system sans、没有JOINED Jakarta role绑定；父级C visitor family仅在`.pg01-visitor`，不算成功页字体接入。

源20个Material Symbols Outlined节点，默认outlined400/FILL0/GRAD0/opsz默认24，**check仅显式FILL1**；文字尺寸不意味着opsz也改为130或42。颜色来自各节点及容器继承，需逐节点固定后留证：

| 源行 | Material 名称 | 显示px / 原颜色 |
| --- | --- | --- |
| 9 | arrow_back_ios_new / person | 24 #1A1B1F / 18 #FFFFFF |
| 21 / 46 | check / sports_tennis | 42白FILL1 / 130白（父opacity.2） |
| 79 / 87 | calendar_today / edit_calendar | 20 / 16，#004CC8 |
| 95 / 104 | location_on / navigation | 20 #FF2D55 / 16 #1A1B1F |
| 111 / 124 | payments / qr_code_2 | 20 #647700 / 36 #004CC8 |
| 147 / 161 / 166 | forum / groups / content_copy | 18 #34C759 / 20白 / 16 #424655（R1群功能未开放，不新增假交互） |
| 177 / 182 / 224 | group / chevron_right / person_add | 20 #004CC8 / 16 #424655 / 16 #FF2D55 |
| 235 / 255 / 259 / 265 | verified_user / arrow_forward / ios_share / check_circle | 18 #004CC8 / 18白 / 22 #181E00 / 18 #D2F803（最后仅原prototype toast） |

源已声明Jakarta角色：headline-lg-mobile22/28/700、headline-md20/26/700、headline-sm17/22/600、body-md15/21/400、body-sm13/18/400、label-lg15/20/600、label-md13/16/600、label-sm11/14/700；正文显式`font-medium`费用段为500，不能把已有四weight脸称完整覆盖。原源h1 `tracking-tight`覆盖角色letter spacing、成员header/编码显式bold、费用amount显式semibold等仍要逐节点核级联。Tailwind3.4.17官方 [fontSize / fontWeight generator](https://raw.githubusercontent.com/tailwindlabs/tailwindcss/v3.4.17/src/corePlugins.js) 明确fontSize options会生成font-weight，不能只读font-family或类名推断最终形状。

### 当前真实成功契约与保护范围

`event.wxml:35–41` / `event.js:798–810, 864–965, 1130–1177` 已读。

- JOINED由真实registrations结果+当前CONFIRMED回读设置；`validateSuccessState` 同时要求myRegistration CONFIRMED、event状态RECRUITING/CONFIRMED/IN_PROGRESS；refresh状态变化会撤销成功。
- `addJoinedCalendar` 真调用 `wx.addPhoneCalendar`；先refresh核身份/本场/未来start/end/title与API可用性；callbacks再核attempt/refresh id/event引用，授权或失败显示真实失败。源addToCalendar只toast“已生成并同步”，不可覆盖此实现。
- `copyJoinedVenue` 先refresh再核JOINED/CONFIRMED/actor/version上下文，调用真实city+venueName剪贴板；此动作是复制地点，源“导航”按钮没有地图证明，不能改成伪导航。
- `joined-ticket-proof` 解释服务端回读与有时效动态签到码，跳checkinSection。`timedEventControls`真实开放条件为活动CONFIRMED/IN_PROGRESS、起止合法、start−30分到end+30分；参与者还需CONFIRMED。源固定编码/QR glyph不能作为票据或签到凭证。
- `memberCards` 是本人同意公开的实际昵称；统计event.stats.confirmed/maxParticipants；显示最多4并明确可能含候补。原Luna/Tony/Maya、头像照片/主办微信luna_irl99、6/8、还有2席不得复制。
- 社区保留现有公告与问答 `contentSection`；群聊/个人微信未提供真实字段或授权。真实cancellationRule保留，原“12月12日免费取消或转让”不是本场规则。
- `goToItinerary`、`viewSuccessDetails`、`shareCurrentEvent`保留。当前非host share为真实复制安全活动信息、host进入真实share卡；源toast邀请不能替换邀请资格/口令行为。
- 后续只能给羽毛球JOINED配置原稿视觉；PUBLISHED（含待运营审核）、genericJOINED、非CONFIRMED、host/member详情、报名确认、C访客与全部其他section保护。原canvas38 confetti/180frames仅装饰，当前没有，不自动增加产品脚本。

## 6. 原稿未定义 token / 不确定项

| 原稿 | 未定义 / 必須留意 | 后续约束 |
| --- | --- | --- |
| caper_ai | `rounded-2xs`、`shadow-2xs`、`shadow-xs`、`active:scale-98`、`w-13 h-13`、`py-0.2`均不在原extend或v3默认相应scale中 | 无有效自定义CSS，不猜2px阴影、52px尺寸、0.8px padding；w/h13是公共tab源，不触碰现有公共nav |
| pg04 | utility无上述未定义项；back及多chevron根viewBox缺失 | 不补猜24viewport；不复制固定手机壳/simstatus/homebar |
| pg05 | `shadow-xs`、`backdrop-blur-xs`未在原extend或v3默认定义 | 不猜blur4；poster按实际aspect，而不是猜固定高 |
| pg05_s | 原自定义spacing/font role均有定义；envsafe、role+font-bold/medium/tracking/leading的级联需逐节点记录 | 不把原画布884/假票据/微信群当实现；Material FILL1不得用FILL0替换 |

依据为完整原tailwind.config/customstyle与官方 [v3.4.17默认配置](https://raw.githubusercontent.com/tailwindlabs/tailwindcss/v3.4.17/stubs/config.full.js)：blur71–81、radius87–97、shadow108–117、scale803–814、spacing841起。spacing13/.2、shadowxs/2xs、blurxs/radius2xs不存在；现有完整源码未补定义。此处只读识别，没有编译/测试原HTML或复制镜像。

## 7. 主包预算与可复用资源

最近已知Wave65主包2046014 B，距2MiB51138 B；本Wave66原始源净增A6378+B14496+C29131=50005 B，简单原始差额仅1133 B。**原始字节差不是最终preview包体**，实际整合包由root实测；此审计不为下一批资源预先分配可用预算。

优先复用现有字节，不复制照片；未来新增source证据/字体/outline证明放docs，不放主包。下列是已存在可复用候选，颜色/字体变体仍需源证明，不能仅凭名字宣称精确：

| 现有主包路径 | 源关系 | 必须保留的差异 |
| --- | --- | --- |
| `/pages/index/assets/calendar.svg` / `map-pin.svg` | caper_ai日期345/地点414几何、stroke2及gray400 #9CA3AF均可复用；pg05pin同几何 | pg05灰色是zinc400 #A1A1AA，不能用现字节声称颜色一致 |
| `/pages/event/assets/pg01-groups.svg` | pg05:197相同path/两小circle几何、stroke2，442 B | 现gray400 #9CA3AF，pg05 zinc400 #A1A1AA；不能替换pg04的1.8stroke另一组peoplepaths |
| `/pages/event/assets/pg01-back.svg` | pg05:96同d、stroke2.5，197 B | 现白色，pg05 #18181B；pg04d与stroke2均不同 |
| `/pages/event/assets/pg01-more.svg` | pg04:99/pg05:104同三circle r2，202 B | 现fill白，pg04gray800 #1F2937、pg05 #18181B；仍是inlineSVG，不是Material |
| `/pages/event/assets/pg01-chevron.svg` / `pg01-seat-chevron.svg` | caper_ai更多220同`M9 5l7 7-7 7`几何 | 现root尺寸/颜色须核；pg04是`M9 18l6-6-6-6`并缺viewBox，不能按相似名字复用 |
| `/pages/create/assets/back.svg` | pg05_s的arrow_back_ios_new、24viewBox源轮廓、#1A1B1F，173 B | 可作为成功页精确候选；不能替换FORM/pg04/pg05 inlineback |
| `/pages/create/assets/person.svg` | pg05_s相同Material outlined person轮廓且白色，544 B | 匹配18显示尺寸；FORMperson是inlineHeroicons，不能混用 |
| `/pages/event/assets/pg01-calendar_today.svg` / `pg01-location_on.svg` | pg05_s相同Material outlined名称、官方固定commit轮廓 | 当前两者#1F2937，成功页需蓝#004CC8/粉#FF2D55；不能直接称字节精确 |
| `miniprogram/subpackages/profile/profile-edit/assets/…` | 有sports_tennis、check、content_copy等留存轮廓候选 | 子包路径仅盘点，不称当前主包成功页已经可直接读取；FILL、颜色、main/subpackage引用规则及包预算后续独立核 |

Material已有固定Google源commit `bd8cb85bd4bad964fe6918f79665bb40c3a8efef` 与 `docs/licenses/material-symbols-Apache-2.0.txt`；C和IDEA源metadata各在独立docs evidence，不复制字体进应用。pg05_s其余字形仍未在本次导出，不创建新资源；check需FILL1另核，不能照已有regular400/FILL0候选算完成。

已有JPEG字节（不复制；前三个是当前FORM展示封面，不证明与源CSS mini poster相同）：

| 现有路径 | bytes | SHA-256 |
| --- | ---: | --- |
| `/assets/stitch/caper_home_badminton.jpg` | 56146 | `df87413d3555b9f9b7cb7428a23ad2cbe1dad270fade6f53867ab29e29f2647d` |
| `/assets/stitch/caper_discover_coffee.jpg` | 75091 | `8c0b55f856d8fbf2fc565b240aff905bcd4a8a0fdc5db4e2047591bebb71d07e` |
| `/assets/stitch/caper_discover_citywalk.jpg` | 63210 | `29ec54d0a3ad4928008e957d8229c72d0a357167098d458d749c4d391d09faa2` |
| `/assets/stitch/pg01_badminton_player.jpg` | 36028 | `9d3ffba93e70736ff1d8d72c3f8387e2a7f3e4fafca6c0a9f56b1be2fb03db88` |
| `/assets/stitch/pg04s_badminton.jpg` | 63131 | `8d4c18256599f7d9ab5ff629947156507b40da2315fd5e0b4a88434471c0bdbe` |

caper_ai/pg04/pg05源正文无JPEG；pg05_s唯一3远程img全是假成员/主理人头像。没有本场授权头像字段，不能为了复刻假成员下载或新增照片，也不能用pg01或pg04s示意照片伪造此人的头像。pg04_s发布成功照片只是现有可复用素材盘点，不扩本次恢复范围。

## 8. 审计时产品身份与停止点

| 当前读取路径 | bytes | SHA-256 |
| --- | ---: | --- |
| `miniprogram/pages/create/create.wxml` | 29086 | `b5d424441a75206f0d71e5f4b6d7cc0a82cbc1aef4aa4091293a61dbcb120131` |
| `miniprogram/pages/create/create.wxss` | 29928 | `4a23898ee332fcefc018093d54ac7d8a986b66404f5a3e75a23445b60760c5cd` |
| `miniprogram/pages/create/create.js` | 39839 | `ed71d3750551182c6676c8c71e204f1396343d5f5eb46a84f6fde1ff0847d4ef` |
| `miniprogram/pages/event/event.wxml` | 87816 | `265efb383b028a8368166578b04f78f03493020180fdf2363b7aefbd33aaa744` |
| `miniprogram/pages/event/event.wxss` | 98830 | `72bd3f539753dc0c2bbb2da5dcce33fd1ee6514d0dcbe71f7ded3268e7b5f4f9` |
| `miniprogram/pages/event/event.js` | 104032 | `7aba63388c13daae75f2485cf31bea5ab0bd7db1a1568e293a03b31240fd7605` |

本报告是下一批可评审范围、真实绑定、源token/图形与差距的记录。没有新增产品实现、JS改写、resource导出、微信运行或测试；尚未恢复的FORM/新草稿REVIEW/羽毛球joinConfirmation/JOINED全部明确为未实施。下一批如被授权，需先给四个scope分别定义native适配、精确资源proof、protected branch与包预算；本次不自行重画、不操作受保护状态。
