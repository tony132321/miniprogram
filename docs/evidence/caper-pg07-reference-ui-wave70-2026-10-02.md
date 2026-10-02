# Wave 70 PG07 活动公告与问答 — 来源、实施与冻结

2026-10-02。按已批准 Wave70 计划，仅实施 `READY && !successState && !joinConfirmation && activeSection === 'contentSection'`，不限定活动类型。此阶段先冻结供独立审查；后续 `_2`／`_4` 由同一 owner 顺序实施，不代表其已完成。

## 完整来源与有效值

已完整读取原 `pg07/code.html`、`screen.png`、当前 contentSection WXML、有效 CSS 与 `contentTimeline`／真实提问、事实查询、回复、复核业务。来源 ZIP／HTML／PNG 精确大小和 SHA 在 `docs/design-sources/caper-pg07-wave70/source-manifest.json`，原完整 HTML 留存 `pg07-original.html`。

原 header 64px、back／more touch44／glyph24、person32／glyph18；title17/22/600，副标题11/14/700。native header 使用 sticky top0 保留原固定顶栏的滚动位置，并在自然流预留真实 statusBarHeight +64；胶囊避让复用已有 headerPaddingRight，只有标题／副标题必要时 ellipsis，不整体缩小。

原 main side16／bottom112／gap12；时间线 row gap12／avatar40、thread gap16、guide x19／2px；卡片 p12／r16／shadow-sm。正文15/24.375/400，系统正文15/20.625/400，回复13/21.125/400。原嵌套回复的类存在 p-2.5／py-1／pl-3 重叠：一次只读原稿 Tailwind cascade 实测最终 padding **4px 10px 4px 12px**、margin-left8、border-left2、gap10，保存生成 CSS／computed 证明。`shadow-xs`、`shadow-2xs`、`py-0.2` 均无有效定义，未臆造阴影或0.8px padding。shadow-sm 为官方 `0 1px 2px 0 rgba(0,0,0,.05)`；orb 为 source shadow-md，两者未混用。

## 准确图形与字体

`material-and-inline-manifest.json` 记录每个原节点行、属性／祖先、颜色、Unicode、axes、viewBox、path、字节与 SHA。PG07 后置 Material 链接与已留存 Wave69 原 full face URL 相同，使用完整官方 Version2.972 / opsz24 / GRAD0 / wght400。FILL1 星标和 campaign **实际应用 active rclt lookup1**，分别为 `star.fill`、`campaign.fill`，不是仅实例化 FILL1 后仍导出 base glyph。三个 FILL0 back／more／person 轮廓与原 full face 一致，复用既有产品路径；新6SVG合计2959B，字体二进制不进入 app。inline smile 逐原 circle／path，只有 xmlns 与 currentColor→#fff 解析变化。许可复用 `docs/licenses/material-symbols-Apache-2.0.txt`。

Plus Jakarta Sans 仍使用现有400／600／700／800，未新增全局字体。原100..900请求与现四实际脸的来源边界沿用已批准字体审计。

## 真实 R1 和保护

真实 authorName／avatarGlyph、timeLabel、body、statusLabel、parent_id 回复、moderation reason、旧 fact_event_version 提示、复核与真实主办／协办回复资格保留。没有原稿 Luna／Alex／Momo 人名照片或虚构12/12。附件没有真实字段，未放示意标牌作为活动附件；composer 图片按钮明确 disabled 且有可见关闭说明。点赞是无动作的灰色原 favorite outline 和“点赞未开放”，没有计数或成功状态。欢迎语保留当前“直接问主办方”，未声称自由 AI 对话。askFact 与 askQuestion 原绑定／接口／资格不变，提问仍需审核。

`bounded-scoped-check.json`：唯一必要 PG07 静态源／资源／binding／保护检查完成，**8 个原交互契约逐项相等**（handler、data、value、disabled、id、条件及循环）；最终 WXML 结构可解析；6新SVG与来源一致，引用存在；81个原 assets 字节保持。完整新增区域、header fallback和 rootclass 逆除后，与137918B Wave69 WXML逐字节相等；旧162268B CSS前缀完全相等；JS104047B SHA `ccb5b5fede066ba0533b82cb564e816cc3d45ca96778a0d25ac5286d3c11a4bd`／JSON69B SHA `bf33dc7da099d240642a50fe3cf44cee01a2b282f70a80a313c79317c76ad10b` 完全不变。

明确 root 资源迁移例外：费用 hero 两处旧 `/assets/stitch/pg09_expense_rooftop.jpg` 引用改为 `./assets/pg09-expense-rooftop.jpg`；无其他费用模板／数据修改，图片搬移由 root 独占。该两处逆回也包含在完整 WXML 字节保护证明中。

## 冻结与后续入口

产品8路径＝WXML／WXSS +6SVG，新增原始字节 **21258B**；新增图片／字体0B。精确最终每路径 SHA／字节在 `/private/tmp/caper-wave70-pg07/frozen-owned-paths.json`；阶段文件快照 `/private/tmp/caper-wave70-pg07/frozen-product/` 供独立审查，后续共享页面详情实施不影响本次可复核版本。

动作：`.pg07-native-back`→goBack，`.pg07-native-more`→openEventActions，`.pg07-native-person`→真实registrationSection；`#contentRetryButton`→refresh；真问题回复→replyToQuestion(row.id)，复核→goToContentAppeal；`.pg07-send`→askQuestion，事实查询→askFact。`.pg07-reaction-closed`／`.pg07-attachment-closed` 均没有成功动作。

运行前置：READY、activeSection=contentSection、无 successState／joinConfirmation；真实 contentTimeline 与 row.replies 回读，原 canPostQuestion／canUseCollaboration 决定提交能力。主办／有公告权限协办才显示可回复问题，旧版和活动终态仍受原规则限制。未创建任何新记录。此证据是静态来源／绑定／保护，不是微信运行或SDK验收；未重跑旧142、全量、CI、SDK、CLI、Git或总矩阵。

## 独立审查定点修复

独审已有来源／8契约／81资源／字形／保护检查通过，不重跑。按原稿保留3类纯表现：glow pulse2s cubic-bezier(.4,0,.6,1)、12px ping双层1s cubic-bezier(0,0,.2,1)；question input placeholder-style=#737687；back／more／send 原按压scale.95用native hover-class，input-wrap focus-within白底及原shadow-md。新增均为装饰／样式，没有业务method或bind。`review-source-correction-proof.json`逐项逆除恢复修正前全WXML／WXSS，与当时并行详情原字节完全相等；增量1081B。更新后的PG07阶段快照与freeze manifest是最终独审版本，运行支持仍由root单项核验。

最后单项：原generatedCSS tracking-wide=.025em，主办chip11px应.275px，前版误.55px已修正，唯一+1B；`final-chip-tracking-proof.json` inverse回CSS14cb53da…，新stageCSS172787B／c72cc63700e156013af0e9b2c134e4413516167d5f7a2bfcd82a327e36d8e469。原8bindings／glyph／3交互修复未重复检查或改变。
