# Wave69 PG06／PG08／PG09 原稿实施与保护证据

## 范围与结论边界

依据已提交计划 `docs/superpowers/plans/2026-10-02-host-checkin-aa-and-center-reference-ui.md`，基线为 Wave68 `2e3e027`。本 owner 修改 `miniprogram/subpackages/activity/event/event.wxml`／`.wxss`，新增 30 个小 SVG；来源与本证据独占。JS、JSON 原字节未改，无全局 font／config／依赖修改。未执行 Git、微信／SDK／CLI、CI、矩阵或全量测试。

三域的原完整 HTML、PNG 已逐页阅读；原 HTML 与 CSS／token 原文保存在 `docs/design-sources/caper-activity-wave69/`。PNG、ZIP 与官方 font 响应的精确 hash、行节点、axes、颜色、字形路径见该目录 manifest。本报告只证明来源与静态保护；实际渲染、按钮操作与包体由 root 后续限定运行验证，不主张已完成视觉验收或上线。

## 准确作用域

| 来源 | 新作用域 | 旧块保护 |
| --- | --- | --- |
| PG06 | READY／!successState／!joinConfirmation／activeSection=hostSection／isHost／display.isBadminton | 其他类型 host overview 原模板作为互斥 else 保留；所有 overview 后真实工作表单保持原 bytes |
| PG08 | READY／!successState／!joinConfirmation／activeSection=checkinSection | 旧 checkin＋COMPLETED outcome 块完整作为互斥 else 保留，类型照片分支与现有资格不变 |
| PG09 | READY／!successState／!joinConfirmation／activeSection=expenseSection／feeMode=AA | 免费／其他状态原费用块完整互斥保留 |

原 PG01／PG05／PG05-S／PG04-S、details、content、registration、cohost、generic 与 success overlay 原字节通过全 WXML 逆除证明保护。新增 native header 只命中上述三个 guard；原 fallback header 增加对应排除项。状态栏与胶囊使用既有 `statusBarHeight`／`headerPaddingRight` helper；JS 初始化、业务与路由未改。原字号维持，native 胶囊限宽时允许标题／副标 ellipsis。

## 来源几何与内容接入

| 节点 | 有效 source px／字体／paint |
| --- | --- |
| PG06 header | 56px；back／more touch44，glyph22；person32／glyph18，primary #004cc8；标题17／22／600 |
| PG06 hero | aspect16/9、p16、r16；标题22／28／700、tracking -.55；status11／14／600；事实13／16／600、glyph16／white80；贴纸11／13.75／800 italic、-6° |
| PG06 counters | 四列gap8、p10、r12；数量22／22／800，标签11／14／500；真实 confirmed／reserved／waitlisted／requested |
| PG06 members／helper／condition | p16／r16／shadow-sm；avatar44；真实主办 user_id 才显示 star11／700；helper icon36／glyph20 FILL1、紫色 #5856d6；body13／17.875；条件glyph18 FILL1、行gap12、button pill check14 |
| PG06 shortcuts／footer | 三列gap10、py12／px8／r12、glyph22；普通label13／16／600深色，危险粉底／粉字700；quote13／16／500与10／15尾标 |
| PG08 header／segments | header64、back24、touch44；原 `Check In And Feedback` 17／22／600及 `见面 · 参与 · 留下回忆 ✨` 11／14／500；segments p4／rfull／top8、选中蓝色、按钮py8／px12 |
| PG08 poster | r16／p12／#2f3034／shadow-xl；原照片opacity .3／screen／scale1.05；176px蓝／粉orbs、blur64；See You17／22／700 italic、In Real Life13／16／600；GOOD PEOPLE lime／BRIGHTER DAYS 原CSS900 |
| PG08 feedback | p12／r16、精确0 4px 20px -2px影；title17／22／700；popper40／glyph22；两列gap8、py12／px12／r12；实际选中label700、glyph18／700；未选label600、glyph400／outline；下一局48／r12、电蓝→secondary→紫grad |
| PG09 header／hero | header64／back24；原 Pg09费用记录17／22／600，AA副标11／14／700；hero aspect4/3、p16／r16／shadow-xl，原85／45／35%黑scrim；amount28／36／800，128×6金色brush |
| PG09 details／roster | strip p10／r12／black55／blur24，group18；成员card p16／r16、rows p8／r12、glyph avatar44；金额17／22／700，两条真实声明13／18；sort glyph16／expand glyph18、实际展开up source轮廓 |
| PG09 note／AI关闭说明／footer | 原sticky7°、p12×8／r8；Worth It CSS500；AI原三列p10／r12保持，内容明确未开放；费用声明13／21.125；原Good Friends Always ♡、Next Round Soon! 🏸、下一场，更好玩！原paint与字体 |

原 PG06 内层只有水平 px16，没有虚构顶部16px；PG08 segments自带top8。新 CSS 全部为 source px，不引入 rpx 缩放，不补 source 未定义 `shadow-xs`／`active:scale-98`。长页的真实表单仍保留其原布局与绑定。

### 必要真实差异

- PG06 原 photo 与 black scrim 都是 `-z-10`，hero 自身没有创建局部 stacking context；提供 PNG 的 hero 实际近白。本轮保留此实际来源外观，没有自补深色照片，也没有下载／新增照片。事实内容取 display，人数取 stats，第四统计为真实待审核，不冒充原固定已取消0。假头像／人名不复制；现有授权昵称／匿名“我／友”保留，只有真实 user_id=hostId 才显示主办标记。
- 成局只呈现已有最少确认人数与主办场地声明；不增加原固定3日／24小时保证。继续保留人工确认、不是场馆锁位的说明，自动邀约／AI助手关闭。
- PG08 原内联 QR＋中心A 是图案；没有导出为签到凭据，没有加入离线保证。真实 encoder 仍使用240px canvas与原 canvas-id，外层为240+16+16=272px；参与者仍扫码或输入动态口令，host仍按服务端资格与有效窗生成。原固定9／28秒没有冒充实际有效期。
- 反馈保留原 radio-group、checked／disabled、maxlength、reason、提交不确定态、独立反馈结果和人工复核。没有复制原默认已选答案；实际 null为未选，false／true才切换原选中颜色与700 glyph。COMPLETED下真实证据放于反馈卡后，全部原复核／争议／主办私密问题条件保留。非完成态选择只是关闭说明，无可提交假按钮。
- PG09 使用真实 `ledger.totalYuan`／`share.amountYuan`，不额外重复货币符、不计算虚构每人60。成员仍只见本人份额，主办才能看授权全名单；当前／历史、版本、逐分尾差、本人处理与主办收到两条声明及其可写条件不变。“已支付”“账单已对齐”、商户收据与AI分类金额未成为事实；AI拆账三格明确未开放／未接入。保留更多活动操作／举报入口。
- 下一局仍调用既有 `startAnotherEvent` 进入新的 IDEA，不复制当前活动或自动发布。

## 官方 Material 与字体边界

原各 HTML 的后置同 family/style Material face 覆盖前置；PG09前置400也由后置100..700覆盖。正式源是原 CSS 直接指向的 full v374 WOFF2，Version2.972，1,136,920 B，SHA `77f9711f3f896a1d7a34ab95cffc45cfb17d84c223f197c1b90faa0d043006e9`。源 WOFF2仅 docs，程序没有加入 font binary。fvar只有 FILL0..1／default0、wght100..700／default400；opsz24与GRAD0固定。原无span weight utility的 glyph 正常400，不能继承父文本500；原明确 font-bold的星／反馈glyph为700。

最终导出从实际 full font 对应轴实例→cmap→活跃GSUB ligature及rclt→SVGPathPen，Y翻转、不舍入，保存unicode／path／paint／source line。33个 source／交互变体中30个新运行SVG、3个旧准确轮廓复用。原ligature raw outline的 full与之前 icon_names 子集同Version2.972仍有两条700路径差：check_circle／task_alt；本次以full路径修正。原raw比较余31与full相同，不能由此省略FILL1的active rclt。PG09展开态up也来自full，未旋转或猜绘替代。

已有四 Jakarta400／600／700／800 face复用。按 `docs/evidence/caper-pg08-font-weight-boundary-audit-wave68-2026-10-02.md`：PG08两处CSS900保留、现有真实800face为可用匹配；不新增冒充900。原CSS500角色仍声明页面原family，未使用仅profile的 `Caper Jakarta Profile 500`。原100..900 URL当前失败，不作为有效variable900字体证据。现有 Material Apache-2.0许可复用，source manifest记录license及原URL；无新许可类别。

## 一次必要检查与定点修正

`docs/design-sources/caper-activity-wave69/bounded-scoped-check.json`：一次142项定向检查通过。包含完整模板tag nesting、224个binding／78个现有方法、89资源引用、29新SVG实际full轮廓／paint、4旧glyph准确复用、51旧资产immutable、JS／JSON与基线及root immutable archive相同、旧CSS前缀、源scope原native control contract。PG06／PG08／PG09原控制方法、data、id、checked、disabled、canvas和输入参数逐支比较，只有费用页保留的安全入口是明确新增绑定。

完整 WXML逆除SHA恢复 `06741c8056566a32f33f356ce65f9aabfcb2164d950a6c288c28e2ec48f0fdf3`；旧CSS前缀SHA `36f4980f427bdf6502ffa2f068dbd935bd028a37c5b563f6860c76715a3b742f`。临时精确逆除映射 `/private/tmp/caper-wave69-event/wxml-inverse-edits.json`，基线 `/private/tmp/caper-wave69-event/baseline/`；持久source manifest有各替换分段前／后hash，原else块仍可复核。未保存第二套产品镜像到docs。

完成142项之后，按精确原节点定点恢复PG08标题／副标／lime品牌、PG09三条footer文案／tint颜色、PG06快捷按钮paint与PG06／08没有额外顶部padding。证明 `source-text-refinement-proof.json` 含9项定点来源／完整逆除／前缀检查。没有重复142项或业务测试。

## 独立审查 FILL1 active rclt 修正

独立 reviewer 指出真实 source 字形问题，owner 按 receiving-code-review 技能核对 full Version2.972 FILL1／wght400：DFLT与latn FeatureIndex=[0,1]，feature0为rclt→lookup1(Type1)，feature1为rlig→lookup0。rclt实际把 `lightbulb`／`check_circle` 换成 `lightbulb.fill`／`check_circle.fill`；初版仅导出ligature原glyph，不能证明filled最终形状。

本次只修本页 `w69-lightbulb-w400-f1-ffffff.svg`，新增 `w69-check_circle-w400-f1-34c759.svg`，将新PG06两处check_circle引用改至新页资源。旧 `pg04s-check_circle_fill1.svg` 历史资产原bytes保持。准确SVG分别392 B／SHA `1c4735c5cbbe480656046b8dccea841c8fd0bde367e2a23dc227194beb4ac5a9` 与493 B／SHA `6c1cf4026c3c5a55cfd3961b6b6f64904e2a956a815db494b926bd7001ed500e`，原颜色／轴／viewBox保持。

`fill1-rclt-correction-proof.json` 记录active features、single substitution、正确path及前后hash；WXML仅两src改动，逆除恢复初freeze `e20243e5…`，继续全逆除恢复基线 `06741c80…`。FILL1这一步31条其余产品／JS／JSON hash逐条保持，其中CSS当步仍 `caef3ec1…`。不重跑142检查；其早期raw-FILL1两项来源断言已明确由该定点证明替代。最终为30新SVG、3旧准确复用，33 source变体数不变。

### PG06 三个独立 source role 定点修正

核原 HTML:64／99／149，成员标题小组 `gap-1.5` 复原6px，剩余人数圆圈 `text-label-md font-bold` 复原13／16／700，场地右二级 `text-body-sm` 复原13／18／400。仅这3处CSS，bind／数据／其余节点不改。`pg06-role-correction-proof.json` 记录前后bytes／SHA，逆除恢复FILL1修正时CSS `caef3ec1…`，WXML／JS／JSONhash不变。没有重跑142。

PG09原header外层code.html:3的 `gap-gutter` 为12px，独占 `.pg09-native-nav{gap:12px}` 复原；source helper、字号与ellipsis不改。`pg09-native-gutter-correction-proof.json` 给出追加一规则的精确逆除，不重复已过检查。

### 新 scope shadow-sm 实际角色纠正

官方 Tailwind3.4.17 `stubs/config.full.js:109` 的shadow-sm是 `0 1px 2px 0 rgb(0 0 0 / .05)`；原先写入的双段值为110行DEFAULT，不能称sm。经root明确授权，仅纠正新Wave69 15处source shadow-sm：PG06 hero／status／sticker／stats／members+conditions／avatar／helper／helper-icon／shortcuts，PG08 popper／两选中choice，PG09 members／avatar／AI关闭卡；并补PG06 native person同shadow-sm。有效CSS值为 `0 1px 2px 0 rgba(0,0,0,.05)`。

`shadow-sm-correction-proof.json` 列15+1实际selector／官方源SHA／局部逆除。旧131951B CSS前缀、lg／xl／2xl／inner／自定义影与文字drop-shadow逐项保持，WXML／JS／JSON不变。沒有重复142或原业务检查；独立review只核此局部差异。

## root 限定运行选择器与真实前置

| 路径 | 选择器／动作 | 前置与验证边界 |
| --- | --- | --- |
| PG06真实host | `.pg06-native-nav`、`.pg06-hero`、`.pg06-stats`、`.pg06-members`、`.pg06-shortcuts`；原 `#hostAnnouncementShortcut`、`openShareCard`／`openHostCompletion`／`cancelEvent` | 已有 approved/full event `0e51f241-3f63-439d-b59d-593549a61ac2`，真实host；display.isBadminton。source status为动态，不要求伪造IN_PROGRESS。最终结项／取消仍按原条件和确认流程 |
| PG08 live host | `.pg08-native-nav`、`.pg08-modes [data-mode=host]`、`#checkinScreenTokenButton`、`canvas-id=checkinQrScreen` | canManageCheckins＋canGenerateCheckInToken及实际窗。root已回读 `02c295b8-10e0-4602-8d25-1dc0d801a5f1` IN_PROGRESS／host `caper-r1-actor-20260930`，本轮只做有界动态token，不假离线 |
| PG08完成未反馈 | `#memberFeedbackCard`、`#feedbackHeldYes／No`、`#feedbackRepeatYes／No`、`#submitFeedbackButton`、`.feedback-next-round` | `dca728a9-f387-4fbf-a301-4f8558ee2f6b`／`caper-pg08-muo8i0wn-member-1`，COMPLETED＋CONFIRMED＋outcome；root已回读未提交。允许选项只读／不重复提交 |
| PG08完成已反馈 | `.feedback-recorded`、`.outcome-summary` | 同event／member-3，root已回读已提交true且 MEMBER_CORROBORATED；source卡呈真实关闭态 |
| PG09当前host | `.pg09-native-nav`、`.pg09-hero`、`.expense-detail-toggle`、`.expense-members-heading button`、`.expense-members-toggle`、`#markReceived-<user>` | 同IN_PROGRESS event实际AA ledger `3e485179-8ded-442a-9964-43d8b49572e9`，10001分／5 shares；展开／排序／明细复用，不重复标记已收到 |
| PG09成员单份额 | `.expense-share-name`／`.expense-share-declarations`、`#markHandled-<user>` | `caper-r1-pg09-member-1-20260930`，API仅本人1share；核显示本人份额及声明，不扩展他人可见权限 |

旧入口 `/pages/event/event` 完整参数转发仍由 Wave67 已有兼容入口负责，本轮不改；新页实际路径为 `/subpackages/activity/event/event`。event id、section query、身份校验、返回栈仍使用既有JS。

## 最终冻结

最终产品与全部本owner证据逐文件 bytes／SHA、产品净增由 `/private/tmp/caper-wave69-event/frozen-owned-paths.json` 给出。产品WXML／CSS正文不再继续修改；任何后续独立审查具体纠正都另记单项差异，不重跑已通过全检查。root后续限定SDK与整包结论不能由本静态报告替代。
