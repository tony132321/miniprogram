# Wave 69 后续原稿差距审计：PG07 与 PG02-B / C / D

日期：2026-10-02。性质：只读来源、现有状态、按钮及下一批实施范围盘点。根代理报告 Wave 68 已 immutable freeze 并提交 `2e3e027`；本审计没有运行 Git、微信 SDK / CLI、产品测试或全量检查，没有修改产品、配置、字体或验收矩阵。

## 1. 边界和阅读证据

已完整读取四份用户 HTML，并实际查看四份原 PNG；原 ZIP 为 `/Users/tsb/Downloads/stitch_design_system_generator (2).zip`。来源展开目录 `/private/tmp/irl-stitch-original/stitch_design_system_generator/`。临时解析、直接节点文字、精确 glyph / 原照片 URL、源 URL 的 39 页交叉索引、读取快照均在 `/private/tmp/caper-wave69-home-members-prep/`。该目录是下一批准备，不是产品资产或编译验收。

已阅读当前首页 JS 全文、WXML 全文，以及相关 WXSS；活动页只核 PG07 的 `contentSection`、内容数据组装、权限和对应真实动作。Activity PG06 / PG08 / PG09 及 Messages CENTER / Alex 正由其他所有者实施，不能把本次初读活动整文件 hash 视为他们的最终 freeze。审计不再次检查 Wave 67 共享 Tab、Wave 68 profile 或已单独核出的 PG08 字体 900 边界。

| 原稿 | HTML Byte | HTML SHA256 | PNG Byte | PNG SHA256 |
| --- | ---: | --- | ---: | --- |
| `pg07` | 19,165 | `435b969b25bdfcde866d7d83d4cabf50eeae09cdc10bbd8bff10b7a2f22036d1` | 560,936 | `0c9ac1263487ca7c74893da5f3f25b8374c0f9d54b493d687bd3b2f36df9588d` |
| `pg02_b` | 27,642 | `c4bc70b16e1d4a6f3762f699efdc5c8414cf54fcc01158c2d01bfa3b739ad6a7` | 546,434 | `e2580e22077bc9c3842eedbb871ade551bfd4bb557e3a1e01d9bca67e3a59ac1` |
| `pg02_c` | 23,196 | `513bdc25f790648b29bbbd61813eb919f725f35ec46f1c124b01b15397346f64` | 532,266 | `d14f895318eed0a0ef55e1c71144e257f9598a3a3aeac242fda97b3bebd5e6ac` |
| `pg02_d` | 22,993 | `b084f0285633b0d8b6796006419204385a7c5752953d73ef15bb6280b5579698` | 625,803 | `6426787ddd76ed42b7c69f11c22569f7fa952a9a8bfc31e63666b21f8e6bbd47` |

后续实施边界沿用 [Wave 69 计划](../superpowers/plans/2026-10-02-host-checkin-aa-and-center-reference-ui.md)：真实 R1 接口、身份隔离、当前版本及安全开关保持；原 HTML 的静态示例不是用户要求我们增加的业务合同。根代理新增加的 PG06-S 分享弹层也是本轮其他所有者范围。此处仅准备四稿，不写实现、不提前更改共享文件。

## 2. 可直接复用的功能和所有权

| 原稿 | 当前实际页面 / 条件 | 可独占的后续产品范围 | 需要保护的相邻范围 |
| --- | --- | --- | --- |
| PG07 公告问答 | `subpackages/activity/event/event`，`activeSection === 'contentSection'` | 该 section 的 WXML / WXSS、仅该视图生效的 header / composer 样式、必要准确 `assets/pg07-*` SVG、来源与实施证据 | 等 Activity 所有者 freeze 后接续同两文件；PG06 / 08 / 09、PG01 / 04-S / 05、共用动作 JS / JSON、默认 header 和其他 composer 保持 |
| PG02-B 待确认 | `pages/index/index`，`activeTab === 'pending'` | index WXML / WXSS，按真实 registration state 区分的纯展示分支，必要准确小 SVG | 普通首页 `.ordinary-view` / `.home-reference-core`、其他状态、真实 guard / action JS / JSON、共享 Tab 保持 |
| PG02-C 我组织的 | 同页，`activeTab === 'organized'` | 同一 index owner 与 B / D 一起恢复；按真实 host status 选择样式 | 草稿筛选、审核中 / 未通过 / 暂停招募、已取消 / 已过期等真实额外状态保持 |
| PG02-D 历史 | 同页，`activeTab === 'history'` | 同一 index owner 与 B / C 一起恢复；COMPLETED 与中性终态区分 | 非主办身份、真实反馈、AA 阅读资格、再约的安全守卫保持 |

首页三个稿共用产品文件，宜一个 owner 同时处理，不能给三个代理并行覆盖同两文件。PG07 和首页可在 Activity freeze 后独立并行。若为了显示来源中现有接口未提供的旧 / 新时间、候补名次或头像，必须先有可核的数据合同与独占 JS 变更范围；本次不自行增加查询、字段或成功态。

## 3. 共用来源尺度、字体和平台限制

四稿均是 Plus Jakarta Sans family。第一份字体请求是 normal 400 / 600 / 700 / 800；后置 100..900 请求的已知边界见 [PG08 字体审计](caper-pg08-font-weight-boundary-audit-wave68-2026-10-02.md)。复用已有四个 Jakarta 字节，不新增 900、不把 800 文件登记为 900。source `font-medium` 500 在原有四面中按原匹配范围处理；仅 profile 使用的 `Caper Jakarta Profile 500` alias 不应扩到这些页面。

| 来源 token | 精确源值 |
| --- | --- |
| body-md | 15px / 21px / 400 |
| body-sm | 13px / 18px / 400 |
| headline-sm | 17px / 22px / 600 |
| headline-md | 20px / 26px / 700 |
| headline-lg-mobile | 22px / 28px / 700 |
| display-mobile | 28px / 36px / 800 |
| label-lg | 15px / 20px / 600 |
| label-md | 13px / 16px / 600 |
| label-sm | 11px / 14px / 700，字距 .02em |
| space-xs / sm / md / lg / xl | 4 / 8 / 12 / 16 / 24px |
| 常用色 | 背景 `#faf8fe`；正文 `#1a1b1f`；次文 `#424655`；outline `#737687`；electric-blue `#1D64F2`；primary `#004cc8`；violet `#5856D6`；pink `#FF2D55`；pink-soft `#FFF0F3`；lime `#cdf200`；lime-tint `#F3FEE7`；green `#34c759`；green-soft `#EBF9F0` |

B / C / D body 显式 body-md；PG07 body 只有字体 family，其未覆盖节点仍按原浏览器默认 / Tailwind preflight，而不是凭同 family 全页推成 15px。原 `leading-snug` 为 1.375；`leading-relaxed` 为 1.625；指定 token 的 line-height 与后来 class / inline 覆盖须按实际级联核，不按 class 字面书写顺序。

原 `py-0.2`、`shadow-xs` / `shadow-2xs`、`active:scale-98` 等没有本稿定义，不能从名称猜数值。PG07 nested reply 的 `p-2.5` 与 `py-1` 重叠，实施前只需针对原有效级联明确最终 Y padding，不能凭 PNG 捏成任意值。原 PNG 只支持画面观察，不能证明浏览器历史字体匹配或未定义类的尺寸。

B / C / D 原应用 header 为 56px，PG07 为 64px；blur-xl 为 24px。微信原生胶囊、status top 及动态 inset 继续依据真实 API，不能硬放原浏览器系统状态栏。index 现有 `headerPaddingRight()` 在有效胶囊时返回 `ceil(windowWidth - menu.left + 8)px`，旧版 fallback 为 112px。原 source 在其普通浏览器完整横宽展示，微信窄屏品牌需要真实剩余空间和截断，不能为了相似覆盖胶囊。共享底部 5 槽 / 24 SVG / 64px + safe 已恢复；本次不重做 Tab。

## 4. PG07：已接真实内容，仍缺精确时间线

### 4.1 来源与当前差距

原稿 header、welcome 及固定 composer 是 source HTML 第 3、7–30、164–174 行；host / system / question / reply 时间线位于 35–160 行。当前产品对应 `event.wxml` 初读 256–274、`event.js` 内容组装 65–112、权限 487–501、refresh 506–610、真实动作 1490–1538；相关 WXSS 110–126、293–325 及之后权限 / composer 覆盖。当前值多数是 rpx；下面 px 换算仅用于说明 375px viewport 下约 .5px / rpx 的差距，不作为新设计。

| 区域 | 有效原稿 | 当前缺口 / 后续恢复要点 |
| --- | --- | --- |
| 整体 | 64px header；main top64，内容 side16 / bottom112 / gap12；surface→canvas→bright 纵向渐变 | 当前 content container side28rpx≈14px、top20rpx≈10px、bottom115rpx≈57.5px；默认 header 需 `contentSection` 独立作用域，不能改其他活动区 |
| welcome | r16 / p12；从 `#EBF2FE` 经 white 到 `#F2F1FD` 向右；48px orb 容器 / 44px 内圆、blur6光晕、12px lime ping；28px 原 inline SVG 笑脸 | 现 67rpx≈33.5px 文本☺ orb，缺原 SVG、光晕和 ping；气泡 13px / snug、p8 / r12 / blur12，现约11px且 padding 与圆角不同 |
| 时间轴 | row gap12，40px avatar；guide left19 / top24 / bottom16 / width2，背景 `#e3e2e7` | 现 32px头像 / 9px gap / 1.5px线、left15.5px / top32px；重构原列关系同时保留真实 item key / 层级 |
| host 卡 | white p12 / r16 / shadow-sm；author17 / 22 / 600；role11 / 14；time11 / 14；body15 / relaxed24.375 | 现 author约12.5px / 800、time9px、body13px；不能把原示例“阿林”覆盖真实别名 |
| system 卡 | 40px绿色 avatar、campaign20 FILL1；p10 / r12 / green-soft60% 内卡、body15 / snug20.625 | 当前尺寸、圆角及文字均较小；保留真实系统内容，不能插入“12 / 12”假满员消息 |
| question | 源普通卡和发言同样 body15 / relaxed；favorite15及源计数11 / 14 | 原点赞 DOM 演示无真实 API；几何可恢复，点赞需关闭而非假计数或假成功 |
| nested reply | ml8 + border-left2 `#dbe1ff` / pl12，avatar24，body13 / relaxed21.125；真实父级边界 | 当前整体 offset / 全框 border、约18px头像 / 10.5px body不同；保留 ANSWER.parent_id 的真实关联，不串到别人的问题 |
| composer | outer z40 / surface85% / blur24 / top12 / side16 / safe；inner max512；gap8，input p8 / 16、15 / 21；send44px violet圆按钮 / arrow20 / shadow `0 4px 14px` violet35% | 现胶囊“提交问题”按钮及 gap6 / side11；原 image22 附件槽不能伪接图片上传，真正提交仍调用 askQuestion；没有发言资格时不应因恢复 fixed 样式泄漏到访客或其他 section |

原 welcome 的原 inline SVG 仅两颗圆眼与一条 stroke1.8 圆头微笑 path，属于直接 source child，可准确提取。其 root 属性可加合法 SVG xmlns / viewBox，不能重画近似笑脸。固定 composer 的 max512 原容器、允许长文换行和 safe area 都应保留，不增加 AI 聊天效果或伪发送。

### 4.2 真实入口、数据和按钮

- canonical `pages/event/event?id=<真实id>&section=contentSection` 保留已有 wrapper 转发；`jumpToSection` / `scrollToSection` 做真实 section title、token / 费用分享失效和滚动管理，不另建假静态页。
- `canUseCollaboration` 为 host、已有 cohost capability，或报名 `CONFIRMED / RECONFIRM_REQUIRED / WAITLISTED / OFFERED`；REQUESTED、INTERESTED、访客不能伪装成已允许成员。content GET 和发言可用性仍按现有权限 / 状态。
- `contentTimeline()` 用真实内容 ID、created_at、状态、系统角色、本人有许可别名或匿名“参与者 n”；ANSWER 只有真实 parent_id 匹配 QUESTION 才嵌套。PENDING_REVIEW / REJECTED 仅显示现有可见的本人状态与申诉入口，不能为了原稿外观消掉审核状态。
- `replyToQuestion` 保留 host / capability、允许活动状态、APPROVED 问题、当前 fact version 或 host OPEN fact todo 的检查，再定位真实主办 / 协办回复表单；原稿“回复”不是任意成员直接写 ANSWER 的授权。
- `askQuestion` → `submitContent('QUESTION', questionText)` →真实 POST `/events/:id/content`；ANSWER / ANNOUNCEMENT 同一路径并保留 parentId、身份 / action context、refresh。现成功文案为“内容已提交，审核通过后其他成员可见”，不能改成“已公开发送”。
- `askFact` 真实 POST `/events/:id/facts:ask`，保留同 owner / refresh 的结果和当前状态；这是事实问答，不把欢迎词扩成自由 AI 聊天。
- EMPTY / FORBIDDEN / ERROR + `contentRetryButton` 的 refresh 都必须保留；COMPLETED / CANCELLED / EXPIRED 的闭态与事实 / composer 条件保持。

### 4.3 source 示例能力的闭态

PG07 有 5 个不同原照片 URL：四份示例头像和一张 host 场地附件。当前真实 timeline 没有这些照片 / 图片 attachment 字段，点赞 API 也不存在。它们可作为来源差距列明，不能把原人像或场地图直接挂到真实作者 / 真实活动。原 JS 仅 DOM heart toggle / 清空输入并短暂改 placeholder，不能作为内容写入成功证据。恢复原头像尺寸和附件 / heart 槽时需保留明确关闭说明或以现有真实匿名图形替代，并如实标出未达到原照片字节一致，不制造真实用户数据。

## 5. PG02-B：三种待确认状态需要独立几何

当前 `stateView` 是 `activeTab !== attending`；pending 含 `INTERESTED / REQUESTED / WAITLISTED / OFFERED / RECONFIRM_REQUIRED`。真实 `/me/events` 分组和 `enrichStateCards()` 每批 3 场 detail 读取、身份 / generation / request key 防串保持。当前 WXML 77–108 三态共用 generic card，尚未把 REQUESTED / RECONFIRM_REQUIRED / WAITLISTED 做原稿三种布局。

| 区域 | PG02-B 原稿 | 当前 / 可恢复范围 |
| --- | --- | --- |
| AI banner | 向右 electric-blue→secondary→violet；p12 / r16；orb48 + white20%圆层 / inner32 / smart_toy22 FILL1；128px lime blur40 与 96px pink blur24；headline17 / 22；本稿 title 内 arrow16，无独立右圆按钮 | 现 banner rpx约59.5px min-height、orb32.5px和✦、所有状态都右箭头；可保留真实 goCreate，按 B / C / D 各自源组件恢复 |
| tabs | B label-lg15 / 20；active黑 `#1a1b1f`、px16 / py8、lime count11 / 14 / 800；gap4 | 现通用 tabs；真实 5 组数保留，包括原稿没有的协办，不能硬编码2 / 3 / 4 |
| REQUESTED | cover176 / r16；p12、gap12、card gap16；white card shadow `0 4px 20px -2px` .06；title17 / 22 / 700；hourglass14；meta13 / 18 + glyph18；2按钮 r12 / px12 / py10 / label13 / 16 | 当前 cover343rpx≈171.5px / title14.5px、符号元信息、圆胶囊按钮；按钮仍真实查看报名状态 / 取消申请，不把“联系主办人”标签配到不相关入口冒充 DM |
| RECONFIRM_REQUIRED | pink10px Y / 12px X 紧急 band、warning18；cover176；edit_calendar14；body17 / 22；旧 / 新时间比较 p8 / r12、13 / 18；gray退出 + blue check_circle17 | 当前只有一条通用 cardNote，没有原紧急横条和比较块；home 当前字段没有重确认旧 / 新值与雨天原因，可恢复真实变更提醒几何并保留“核对变更”去真实registrationSection，不编造原因或比较值 |
| WAITLISTED | cover176；filter_list14 胶囊；meta calendar_month / storefront18；p8蓝底候补说明，24px圆容器 / notifications_active15 / body13 / snug | 当前统一!提示；源码“第1顺位 / 等待4小时 / 自动通知”无对应 home 数据和正式订阅验收，不能硬填。保持尚未确认席位的真实 note，OFFERED 仍走真实通知定位 |
| footer | check_circle20 + 原 body-sm 文案 | 现✦图形与通用 footer；准确 source glyph 可小 SVG 恢复 |

真实动作：REQUESTED 且 REVIEW_PENDING / RECRUITING / CONFIRMED 才有 `pendingExit`，仅定位 registrationSection / entry=pendingExit，由目的页核对退出；RECONFIRM_REQUIRED  primary=registrationSection；OFFERED primary=offerNotifications，带 eventId + owner intent 到“我的”通知，保留有效期、接受 / 拒绝与读回守卫。没有在首页直接 accept / reconfirm / quit 的新写入。原源三卡不能抹掉 INTERESTED、OFFERED 或真实其他安全状态。

## 6. PG02-C：招募与成局主办卡的组件不同

| 区域 | PG02-C 原稿 | 当前 / 可恢复范围 |
| --- | --- | --- |
| banner | 向右 `#EBF2FE`→`#F2F1FD`→white、r12 / p12、shadow `0 4px 20px -2px` blue8%；orb44 + neurology22，112pxblue10%glow；独立白色36px箭头圆按钮 / arrow20；subtitle13 / 18截断 | 当前沿用 B 通用深色组件；仍绑定真实 goCreate，不能保留原“AI自动做AA”能力承诺 |
| tabs | label-md13 / 16；gap8 / py2；inactive `#e9e7ed`；active黑 / count white20% | 与 B 的15px tabs不同，需 C 独立选择器，不横向污染普通首页 |
| cover / body | **aspect16/9**，并非固定176；r16，shadow `0 4px 24px -4px` .06 + `0 1px 3px` .02；p12，title20 / 26 / 700 | 现统一171.5px cover / 14.5px title；源招募 pill / +3° Good Game lime sticker / 白底 BADMINTON strip 与成局白pill / −3° Spring Ride pink sticker / 深色 Confirmed & Ready strip不同 |
| 招募 stats | p8 / r12 / `#f4f3f8`，4列 / gap12；count22 / 28 / 700，label11 / 14；confirmed、reserved、requested、gap颜色分别 primary / violet / pink / green | 当前 count17px / 900、label8px；真实 hostCounts 现有可复用，缺 stats 时关闭，不写原2 / 1 / 2 / 2 |
| 招募动作 | h44 roundedfull 蓝 primary、arrow18 / 15px；gray campaign18次按钮；share44 circle / share19 | 当前约36px /10.5px动作；真实发公告入口不是群发，share只在真实 shareReady；当前接口、字段和入口已经存在 |
| 成局内容 | title20；meta13 / 18 + schedule / route17；lime-tint reminder p12 / check20；头像组与source8人微信群说明 | 提醒可沿真实 cardNote排版；原天气、微信8人群、示例昵称没有对应字段，不能据原稿制造事实 |
| 成局动作 | 2×h44，gray管理活动 tune19；blue签到核销 qr_code_scanner19 | 当前通用蓝 primary / gray secondary与源颜色反向；按真实 CONFIRMED / IN_PROGRESS 的现有 action作纯样式分支，保留 actual hostCheckin入口 |
| footer | 36px圆形 verified18、body13 / 18 + upper label11 / 14 / 字距 .1em | 现✦ / 通用footer不同 |

真实主办动作保护：DRAFT 编辑 intent、APPROVED & recruiting=true 的招募 / 发公告 / 分享资格、review PENDING / REJECTED / APPROVED但暂停等区分；管理活动只按真实 host，签到核销只在允许状态。`hostAnnouncement` →同活动 hostSection / entry=hostAnnouncement；`openHostShare` →同 ID 分包 share。请求列表 / 私信 / 微信群人数不在原 stats 之外凭空扩展。

## 7. PG02-D：历史画面和可用动作不能按样例硬套

| 区域 | PG02-D 原稿 | 当前 / 可恢复范围 |
| --- | --- | --- |
| banner | 135deg electric-blue→violet、r12 / p12 / shadow-sm；orb44 / white20% / inner32 lime→blue / arrow_back_ios_new20；lime12 status点；112pxlime20%光层 | 当前通用32.5px✦ orb；真实 goCreate保留，sourceAI回忆能力不宣称已接 |
| tabs | label-md13 /16，px14 /py6 / gap8；history active inline `#0F172A`，count10px / white20% | 现所有 tabs通用active黑 /lime count，与 B/C/D不同 |
| first cover | h176；原 background image `saturate(.85) contrast(1.05)`；black60%→10%渐变；MEMORIES −3°、r6、verified13；真实状态 pill；bottomtitle17 /22 /800、date11 /14 /lime | 当前所有history cover318rpx≈159px、无该独立滤镜 / stickers精确层；第二picnic source h160，不能用同一高度全套 |
| facts / stars | inline date / location13 /18 + glyph16；28px头像组；5×FILL1 star18 /5.0 | 当前符号元信息、没有真实星评分；没有实际人像 /共同参加者计数字段，不能直接装原Alex/Luna人像或8人 /5.0；真实反馈不是五星API |
| first actions | r12 /py10 /px12；蓝“再来一局” auto_awesome18，gray相册 photo_library18 | 当前fullpill /字体和尺寸不同；host COMPLETED才真实再约入口，非host仍反馈 /详情；相册保持关闭 |
| second card | h160 / rate_review14 pink状态；待反馈reminder p10 /military_tech15；purple edit_note18 primary /gray receipt_long18 secondary | 原6人、¥38.50、勋章奖励无现有home真实字段；仅按已确认成员真实feedback /有资格AA route排版，不承诺勋章发放或平台结算 |
| footer | 两边32px线 / outline40%、favorite18 FILL1 pink；quote17 /22 /700 italic、下文13 /18 outline | 当前quote约12.5px /750及简单♡；恢复真正 source 几何 /glyph即可 |

真实历史动作：`openHostRepeat` 先重读活动和 `/system/safety`，核同 identity / generation / request、ID、host、COMPLETED、current version及safety OPEN，再进入同活动 hostSection / entry=hostRepeat。首页不会自动创建新草稿。成员 COMPLETED+CONFIRMED 主动作去真实 checkinSection / entry=memberFeedback；CANCELLED / EXPIRED 保留中性说明和记录。`feeMode === AA` 仅说明AA活动；有host或CONFIRMED / RECONFIRM_REQUIRED阅读资格才提供expenseSection，不把source“已清算”视为当前真实费用状态。

## 8. 准确资产清单与不确定项

临时每页 `*-asset-inventory.json` 记录原 glyph 名、原 class / inline variation、source line、完整照片 URL / class / alt。修正 HTML style URL解析后原照片共 **19条 / 19个不同 URL**：PG07=5；B=7；C=2；D=5。39页源码交叉索引每条均只在本原稿出现；这说明它们不是现有其它稿 URL 的同名复用来源，**不等于已下载原二进制或证明任何现有 JPEG 像素差异**。此次没有请求远程图片、裁图、降画质或生成新素材。原PNG整体截图不等于可拆出的各图片原始二进制。

当前 home coverFor 按标题复用 `/assets/stitch/caper_home_badminton.jpg`、discover类和骑行等既有示意照片；当前ordinary home manifest仅证明 `caper_2` 七个 inlineSVG，不能作为 B/C/D Material glyph来源。PG07 尚无专属准确 SVG。后续可只补必要官方 glyph / 原 inline smile；参考现有固定官方 Material proof，但只有 family、FILL / wght / opsz / GRAD与当前source实际相同才能复用 outline，不能凭相同glyph名称搬 profile600 back或普通首页线性bell。

| 稿 | 非导航 glyph 实际用途（按原行） | 额外边界 |
| --- | --- | --- |
| PG07 | arrow_back_ios_new24、more_horiz24、person18；star11 FILL1；image13附件、campaign20 FILL1；favorite15 FILL1 / 0；image22上传、arrow_upward20；inline smile28 | header back默认400，无profile600继承。image / heart关闭能力仍应明确，不造文件上传 /计数 |
| B | header auto_awesome18 / notifications22 / person18；smart_toy22 FILL1、arrow16；hourglass_top14；calendar_today / location_on18、chat17；warning18 /edit_calendar14 /schedule16；event_busy /check_circle17；filter_list14、calendar_month /storefront18、notifications_active15（24px容器）；footercheck_circle20 | 数据状态和按钮功能已述，未定义count `py-0.2`不能猜 |
| C | 同header；neurology22 / auto_awesome16 /arrow20；sports_tennis13；calendar_today /location_on17；arrow18 /campaign18 /share19；wb_sunny12；schedule /route17；check_circle20；tune /qr_code_scanner19；footerverified18 | 已有四个Jakartaweight保持；源事实如天气/微信群不要套静态字样 |
| D | 同header；arrow_back_ios_new20 /arrow20；verified13；calendar_today /location_on /chevron16；star18×5 FILL1；auto_awesome /photo_library18；rate_review14；schedule /pin_drop16；military_tech15 /chevron16；edit_note /receipt_long18；footerfavorite18 FILL1 | 闭态相册 /星评 /勋章奖励不能按演示写入真实账户 |

24个共享 Tab SVG及五槽行为属于已完成独立范围，这里不新增重复资产。下一批需要补的场景示意原照片应按用户原 URL 保存 source / hash、标签明确示意，并先由根代理核真实主包空间；无需原人像接入真实记录。素材净字节和 CLI最终包体必须从实际增量 / 编译测量取值，本审计不预测编译通过。

## 9. 初读产品快照和建议的最小验证

| 初读路径 | Byte | SHA256 | 说明 |
| --- | ---: | --- | --- |
| `miniprogram/pages/index/index.js` | 32,598 | `d85b9db816163c4853bd2a7a9abec66dc62e8047d9e79c19457f4cb57dc8ac11` | 后续纯展示恢复保持 |
| `miniprogram/pages/index/index.wxml` | 24,707 | `fcbf2764f06abb13207f5534b51bb7c93f563fd42ad4de3ddc55bda424a60da0` | 三状态同owner，普通首页保护 |
| `miniprogram/pages/index/index.wxss` | 47,655 | `5fd04b24883cc3a89188e989e4d04f9ba70ece8d4d9f88916380e07dfceb6aa0` | scoped追加 /改三态，不串ordinary |
| `miniprogram/pages/index/index.json` | 由prep快照记录 | `a082db2fcb674d4131b60f427fcb40891d00e1d2571e372df9827fa25e2f1fb1` | navigation配置保持 |
| `miniprogram/subpackages/activity/event/event.js` | 104,047 | `ccb5b5fede066ba0533b82cb564e816cc3d45ca96778a0d25ac5286d3c11a4bd` | 本初读内容；本轮其他owner同样保护JS |
| `miniprogram/subpackages/activity/event/event.wxml` | 107,929 | `06741c8056566a32f33f356ce65f9aabfcb2164d950a6c288c28e2ec48f0fdf3` | Activity正并行；PG07后续应基于其finalfreeze |
| `miniprogram/subpackages/activity/event/event.wxss` | 131,951 | `36f4980f427bdf6502ffa2f068dbd935bd028a37c5b563f6860c76715a3b742f` | 同上，不断言当前整文件仍相同 |
| `miniprogram/subpackages/activity/event/event.json` | 由prep快照记录 | `bf33dc7da099d240642a50fe3cf44cee01a2b282f70a80a313c79317c76ad10b` | 保持 |

下一批源恢复只做与改动相符的一次资源 /绑定 /保护区域检查，独立审来源和限定selector，不写照搬样式的镜像测试、不重跑已通过整套检查。根代理后续针对真实非空内容时间线 /本文三种pending /两种organized /两种history和额外真实闭态做定向SDK与必要实际点击，确认真实ID与目的section，不静默API写入；最终CLI主包及分包门槛由实际产物核。EMPTY /ERROR /FORBIDDEN仍需确认不被新样式隐藏，但不借此扩为全量。

**本次结论：四稿有可复用的真实入口和关键动作，精确视觉仍有上述差距；已准备下一批独占实施范围，未实施、未编译、未做运行或字形验收，也不据历史通过数字声明当前完成。**
