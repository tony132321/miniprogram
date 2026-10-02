# 下一批发布成功／主办／签到／AA 原稿与功能缺口只读审计 — Wave 67（2026-10-02）

## 1. 范围、当前快照与证据边界

本次完整读取用户原 ZIP 中实际目录 `pg04_s`、`pg06`、`pg08`、`pg09` 的全部 HTML，并查看四张完整 PNG；按当前活动页 WXML、最终生效的 WXSS 级联、JS 身份／状态／版本门控与真实路由整理下一批恢复范围。**本报告仅为只读审计；四页下一批像素恢复、资产导出、字体补充、真机／模拟器运行均未实施。**没有改任何产品文件、他人证据、总矩阵；没有运行测试、SDK、微信 CLI、Git 或全量检查，也没有重查本轮 PG05／PG05_S 原稿。

阅读过程中 root 已将真实活动实现移入既有 activity 分包。本报告采用 `miniprogram/subpackages/activity/event/event.*`，旧 `/pages/event/event` 是兼容入口，不再是完整页面。迁移与其运行验证由 root 独占；本报告不把旧证据中的旧路径当作当前实现位置。原照片仍按现有 `/assets/stitch/...` 路径引用；这里不移动、复制或删除照片。

当前只读快照：

| 路径 | B | SHA-256 |
| --- | ---: | --- |
| `miniprogram/subpackages/activity/event/event.wxml` | 100072 | `c2dd55c68a3123d9969c204df0d1e91ccca69e53dda4ae5c921a12041eeb9720` |
| `miniprogram/subpackages/activity/event/event.wxss` | 120006 | `94049293bebaf3889760403fb43de4b0a3710f82de40d3d0655e54ef5074e6af` |
| `miniprogram/subpackages/activity/event/event.js` | 104047 | `ccb5b5fede066ba0533b82cb564e816cc3d45ca96778a0d25ac5286d3c11a4bd` |
| `miniprogram/pages/event/event.wxml` | 345 | `7c22ffdf7bb255cd8e9dae6399e465129b65384be4dca2e3bb8b3ea7d5280ac3` |
| `miniprogram/pages/event/event.wxss` | 223 | `c05050373a172881009c76f37f54ec1830b1aa39f99ca4cfd806d5dde01e182e` |
| `miniprogram/pages/event/event.js` | 121 | `7794d28eb295a45de9b2015ed80747a0d22e34a0e00874636f0972e3106513d7` |
| `miniprogram/utils/event-entry.js` | 1633 | `4fea7123ae8f9211d6a6ae9bc3aecb1f8a6611ac070f77b3225967e65ab1276f` |
| `miniprogram/app.json` | 1255 | `d8bbcd19830fd03f9cec0117cbbeddf0cdd60e49693508d4fba41696b6e4e72b` |

WXML／WXSS 与 C 冻结字节相同。当前 JS 是 root 迁移后的 require 深度版本；本次仅记录实际字节，不声称重新执行迁移验证。页面 JSON 为 `navigationStyle: custom`。全局字体模块、原 Wave 66 PG01、Wave 67 报名确认／真实 JOINED、generic、注册／公告／协办／安全等分支均属于保护范围。

## 2. 原稿身份与完整源证明

原 ZIP：`/Users/tsb/Downloads/stitch_design_system_generator (2).zip`，24668856 B，SHA-256 `df22e733d33fda20979b75b8a7bc94717c4a5c9e41561a54e3038432fab32603`。解包根为 `/private/tmp/irl-stitch-original/stitch_design_system_generator/`。本次只读取对应 8 个 ZIP entry 并与已解包文件逐字节比较，全部一致；这是来源校对，不是应用测试。目录名确为以下四个，不将 `pg04_s` 混成 FORM、REVIEW 或报名成功。

| 目录／语义 | HTML B／SHA-256 | PNG B／像素／SHA-256 |
| --- | --- | --- |
| `pg04_s` 活动发布成功 | 17310 / `168f4582264fad299c953bd377e915b38a81a2fb01001e5f5259195846f0361a` | 426748 / 545×1600 / `0b216f3226ec3c1e0ef1c1034787f486e7a3f9013118c75bf9265feaaddbcf94` |
| `pg06` 发起人工作台 | 19548 / `05c1f7dccc856304c080298d7680f1e3df91bb765decea2e59efd2c7996b31b6` | 391968 / 672×1600 / `56b6646520ac21c8ed159b6ace92a56899dd27c39379e91571af5b1f9b621a73` |
| `pg08` 签到与反馈 | 20823 / `c54ae75aef6fccc653601e3d9c23d172e22e7de36b5e4022f72880ba1f39de46` | 652051 / 780×1684 / `a18734111819e713f5f2e28edd9b6c0e8b0995c9e73993b533c46cfa7c02ed53` |
| `pg09` AA 费用记录 | 26928 / `3f0f3f3f62d9d863121784e2ad4c3fd65562bb82b3360cea16593158b0c6d8fd` | 511634 / 502×1600 / `1f5309f071bd83244b769c5b549785ff9fc9a6c571336f8c347d9dc479a0cae3` |

HTML 与 PNG 共同是来源。PNG 尺寸是导出位图尺寸，不能按截图宽度把源 CSS px 整体缩放成 rpx；下面几何由 HTML 配置／有效 utility 获取。默认 rem 按 16px 换算，宽度随真实视口 100%，native 状态栏／安全区／胶囊适配另计。

## 3. 四页共有 token、字体和图形规则

### 3.1 字面 px 与字体角色

四页均以 Plus Jakarta Sans 为原文字体。共同色值为主蓝 `#004CC8`、electric blue `#1D64F2`、secondary `#4C4ACA`、violet `#5856D6`、pink `#FF2D55`、lime `#D2F803`、状态绿 `#34C759`、surface `#FAF8FE`、canvas `#F5F6F8`、文字 `#1A1B1F`、次文字 `#424655`、outline `#737687`，soft 色分别为 `#EBF2FE`、`#F2F1FD`、`#FFF0F3`、`#EBF9F0`。间距：margin16、gutter12、xs4、sm8、md12、lg16、xl24；圆角 xl12、源 arbitrary16 等按原字面值，不将所有卡统一取现有 rpx。

| 原角色 | 字号／行高 px | weight／tracking |
| --- | --- | --- |
| display／display-mobile | 34/42；28/36 | 800；−.03em／−.025em |
| headline-lg／headline-lg-mobile | 26/34；22/28 | 700；−.02em |
| headline-md／headline-sm | 20/26；17/22 | 700/600；−.015em/−.01em |
| body-lg／body-md／body-sm | 16/24；15/21；13/18 | 400 |
| label-lg／label-md／label-sm | 15/20；13/16；11/14 | 600／600／700；label-sm .02em |

显式 `font-bold/medium/black` 仍需覆盖角色配置的 weight；不能只看 class 字符串位置或将 `font-headline-sm` 当成 weight700。Tailwind 3.4.17 的 `fontFamily` 只写 family 与字体特性，`fontSize` 可写角色 weight，`fontWeight` utility 注册在其后，见[官方 corePlugins](https://raw.githubusercontent.com/tailwindlabs/tailwindcss/v3.4.17/src/corePlugins.js)。原 CDN 地址未 pin 版本；本审计沿用先前已留存并核过的 3.4.17 官方排序／默认配置作为 utility 推导依据，未启动浏览器重生成全页 CSS。

当前全局接入的是 Jakarta 400/600/700/800、Rubik Mono One400、Caveat700。`pg04_s/pg06` 原导入 Jakarta 400/600/700/800，500 的请求与实际 face 匹配需要区别；`pg08/pg09` **另有** `family=Plus+Jakarta+Sans:wght@100..900` 的真实变量字体导入。PG08 `GOOD PEOPLE/BRIGHTER DAYS` 显式 `font-black` 是 900；PG09 `Worth It!` 显式500，源变量请求可提供该 weight，不能沿用只请求四种字重的其他原稿推导为400。后续应由全局字体负责人核原官方资源和最小实际可见文本候选；本次没有下载字体／WOFF、改 loader、减字体或声称900/500已经接通。中文仍按原字体缺字的系统 fallback 处理。

### 3.2 未定义 token 与原截图疑点

留存 `/private/tmp/caper-wave66-event-review/tailwind-3.4.17-source/config.full.js` 的 boxShadow 没有 `xs`，scale 只有0/50/75/90/95/100/105/110/125/150，没有98；四份原配置也没有补充定义。

| 原节点 | 结论 |
| --- | --- |
| PG08:14 `poster-card-touch` | 源 style 无对应定义，不能新造触摸装饰规则 |
| PG08 段钮／反馈按钮与脚本 class，PG09:218 `active:scale-98` | 不为它补 scale(.98)；源默认无98 |
| PG09:90、232、235、239、243、259、262 `shadow-xs` | 不猜阴影数值；保留其他明确定义的 shadow/arbitrary 值 |
| PG06:6 封面和后续 gradient 均 `-z-10` | 完整原 PNG 的 hero 几乎无可见照片，白字淡出；当前 app 是可见暗照片。必须同时保留 HTML stacking 与原 PNG 事实，不能擅自“修复”成新暗背景或把当前照片证明为源照片。实现前明确采用原 stacking 呈现还是经授权纠正源异常 |

### 3.3 精确图形资产清单

四页使用 **Material Symbols Outlined**，不替换为 Phosphor、Unicode 类似字符或新画图。源请求：PG04_S/PG06/PG08 第一组 `opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200`，另有 `wght,FILL@100..700,0..1`；PG09 第一组显式 `opsz,wght,FILL,GRAD@24,400,0,0`，另有变量 weight/fill。导出固定官方 outline 前需记录实际官方 CSS/font版本/hash、axes、unicode、path与许可；不能把显示字号直接当 opsz。源 `FILL1` 与显式 bold 节点是例外，不能全量以400/FILL0导出。

| 原页 | Material 节点：显示 px／源颜色、例外 |
| --- | --- |
| PG04_S | close22/variant；person18/white；**check_circle36/green/FILL1**；celebration14/violet；calendar_today16/electric blue；location_on16/violet；person_add16/outline；group_add18/electric blue；chat24/#07C160；photo_camera_back24/violet；link24/electric blue；diversity_3 24/#647700；auto_awesome18/white；arrow_forward20/white；visibility20/variant |
| PG06 | fake status signal17/wifi17/battery20 只记录、不能重画 native；arrow_back_ios_new22/正文；more_horiz22/正文；person18/white；calendar_today/location_on16/white80%；chevron_right16/variant；star11/olive、显式font-bold700；**lightbulb20/white/FILL1**；chevron_right20/variant；check14/green；**check_circle18/green/FILL1** 三个；ios_share22/electric blue；send22/primary；stop_circle22/pink |
| PG08 | arrow_back_ios_new24/正文；more_horiz22/正文；person18/white；sync18/electric blue；celebration22/pink；**check_circle18/green/font-bold700**；sentiment_dissatisfied18/outline；**task_alt18/violet/font-bold700**；sentiment_neutral18/outline。无内联 FILL1 声明；bold 节点需核级联后的实际轴 |
| PG09 | arrow_back_ios_new24/正文；ios_share22/variant；person18/white；receipt_long20/white80%；group18/white80%；chevron_right15/white90%；keyboard_arrow_down16/variant与展开18/secondary；check_circle13/green（5个）；auto_awesome16/white；info20/primary |

PG04_S、PG06、PG09 完整原 HTML **无 inline SVG**。PG08 唯一一份为第47行的示意 QR：`viewBox="0 0 100 100"`、36个 rect、原节点2509 B，外部 A 标在 QR 中央；它不编码服务端签到 token，**不应导出成产品凭证**。没有“源无 viewBox 就补一个”的图形需求。PG08/09 原 emoji 和小贴纸文本按源保留为文本；普通 Material 需复用同 path/axes/颜色资产，颜色或 FILL 不同就不能误用现有文件名。

当前分包 `event/assets/` 已有 PG01/Wave67 的真实 Material 与 inline SVG。可先按已冻结 manifest 查 header back/more/share、calendar/location、arrow/chevron/group 等同源候选；本次只列可复用类别，**未重取或改变本轮 PG05/PG05_S**。例如 `check` FILL1 与下一批 `check_circle` FILL1 不是同字形，不能因为都表示成功而复用。下一批导出 source proof 放 docs，必要运行 SVG 仅留分包，不复制照片。

## 4. PG04_S 发布成功：原稿、现有功能与缺口

### 4.1 源几何与有效 px

| 区域 | 源值 | 当前缺口 |
| --- | --- | --- |
| header／main | 固定header56，横16；close触区44/负左4/icon22；标题17/22/600/max200；右person蓝圆32/icon18；main顶部56，内16／底40 | 共用旧顶栏及 rpx 布局；需限定 PUBLISHED header 与真实statusBarHeight+56，胶囊限宽，不缩全页 |
| hero | pt8/pb20；光层224/顶部−24/blur64；圆64/check_circle36 fill1；badge11/14/700、p4×12、mb8；标题22/28/700；copy13/relaxed21.125/max270/mt4 | 现hero circle103rpx、unicode✓/✦、title39rpx、copy24rpx/1.55；图形和字号有差异 |
| 事件卡 | r16；封面 `h-44`=176；black80→20→transparent；内12；白底facts p14/gap10/iconbox24/glyph16；贴纸−右8/顶部12/rotate6/17px；title20/26/700 | 当前cover320rpx、sticker27rpx/950、facts泛Unicode/rpx；真实标题、日期、地点、费用必须继续绑定 |
| roster／四操作 | 原avatar28；source固定1人、4–8和“差3人”；section mb20；标题17/22/600、group_add18；grid2cols/gap12/p14/r12；icon40/glyph24；label15/20/600、副文13/18 | 当前 roster 已是真实服务端确认数+授权昵称；不能为了原排布改回固定人／席位。卡p17rpx/icon53rpx应恢复源px并保留资格提示 |
| 帮手／CTA | tip p14/r12，32紫icon/18white，label13/16/700；主CTA48/rfull/15/20/600/arrow20；次visibility20 | 原“自动托管中／自动成局／群聊”无R1依据；当前受控建议文案须保留 |

原 HTML 只有 copy-btn 改字／link→check 两秒后还原的微交互，未调用真实 clipboard 或发送消息；不能把它作为功能实现证据。

### 4.2 正确作用域与真实动作

候选恢复域：`loadState==='READY' && successState==='PUBLISHED' && isHost`；源是羽毛球，若本轮只恢复源同类型，继续加 `display.isBadminton`，generic 成功态保持旧分支。`onLoad` 的 PUBLISHED 门控已要求同一event id、host、`RECRUITING`、reviewStatus `PENDING/APPROVED`；两个审核态都可进入当前成功页面，但**PENDING不能呈现招募已开放**。原已发布宣传样式对应 APPROVED；PENDING 仍用“提交审核”、待审核贴纸和资格说明。不能因为 success query 直接造发布成功，也不能扩大到 JOINED。

| 原按钮 | 当前真实绑定／应保留的含义 |
| --- | --- |
| 关闭 | `goBack`；成功态先dismiss，再按当前页栈返回 |
| 分享微信／群 | `openShareCard` 进入同场 `/subpackages/activity/share/share?id=...`；真实当前资格允许时追加 share=1，由邀请卡提供真实选择；无资格查看资格，不冒充发送成功 |
| 海报 | `openShareCard` + `data-poster=canCopyPublishedInvite`；资格可用才带poster=1 |
| 复制口令 | `openShareCard` + `data-copy=canCopyPublishedInvite`；资格可用才带copy=1，非原假 copied 动画 |
| 呼叫常聚球友 | 当前第四格 `jumpToSection(hostSection)`“成局与协办管理”；原固定5人／自动邀请无接口，不能假造联系人 |
| 进入工作台 | `jumpToSection(hostSection)` |
| 查看详情 | `viewSuccessDetails` |
| person | `jumpToSection(registrationSection)`；不是个人主页 |

`canCopyPublishedInvite` 要求真实 host、inviteToken、APPROVED、recruiting、风险未暂停、safetyOPEN、服务端剩余有效期正数、有效期与报名截止未过。`openShareCard` 再刷当前 host/identity/event，查询参数只能在当前资格允许时添加。审核／邀请／安全保护不随样式变化。

## 5. PG06 发起人工作台：原稿、真实数据与动作

### 5.1 源几何与当前差异

| 区域 | 源值 | 当前与源的差异／保护 |
| --- | --- | --- |
| 顶栏 | 源假9:41/信号行 + nav56；横16；back44/负左8/icon22；center17/22/600；more44/icon22、person32/18 | 假状态栏不复制；使用真实native状态栏+56。源main只pt56与假状态行存在遮挡，不能把该遮挡写成业务内容偏移 |
| hero | aspect16:9/p16/r16；图与scrim−z10；title22/28/700；status11/14/600；facts13/16/600、icon16；贴纸11/13.75/800italic、−6°、white20+blur12 | 当前生效hero338rpx/p28rpx/r28rpx，title31rpx，facts19rpx，暗照片与源PNG不同；不能靠猜源图修正 |
| 四统计 | grid4/gap8/p10/r12；count22/22/800；label11/14显式500 | 当前min105rpx/p17rpx；第4项真实待审核，源已取消0无法绑定当前stats，保持真实名称 |
| 成员 | p16/r16/gap12；heading17/22/font-bold700；counter13/16/600；avatar44，源5张假照片＋固定1；star11 bold/16limebadge | 当前授权confirmedRoster至多5字形，最终avatar73rpx＋name83rpx等；可以恢复44布局但不能复制假头像、名字和人数 |
| 帮手／条件 | p16/r16；lightbulb36box/20fill1；label15/20/700、副文13/17.875；条件gap14、heading17/22/700、badge11/14/700/check14；条件check_circle18fill1；正文15/21显式500、副值13/16/600 | 当前rpx；source“AI已满足”与“>24小时／3天”不是当前R1规则；保留真实人数、主办场地声明、人工成局与尚未开放说明 |
| 快捷／brand | grid3/gap10/pt4，p12×8/r12/icon22；label13/16/600，danger700；footer13/16/500、signature10uppercase | 当前三快捷与工作区多块共用host-section。恢复上部原布局不能移除下部真实表单／状态 |

PG06 完整 PNG hero 接近白底与淡白文字，原background URL不是当前 `caper_home_badminton.jpg`，不能称当前图为精确该源照片。现有历史报告[主办层级与真实动作](caper-pg06-reference-hierarchy-2026-10-01.md)已明确“已取消”统计、24小时条件、AI结论的业务缺口；该报告是历史事实说明，其旧模拟器／测试数字不作为本次验证。

### 5.2 Guard 与映射

建议首次忠实源“进行中”恢复域明确为：`READY && !successState && !joinConfirmation && activeSection==='hostSection' && isHost && display.isBadminton && event.status==='IN_PROGRESS'`。若后续授权将同一壳扩展到招募、成局、结束等 host 状态，逐项保留现有状态文字、颜色与可用动作，不能把所有主办状态标为“进行中”。source外观适配与业务 guard 分开，DRAFT/PENDING/CANCELLED/EXPIRED/COMPLETED不会因同一hero shell获得不该有的CTA。

| 原按钮／卡 | 当前真实映射 |
| --- | --- |
| 返回／more／person | `goBack`／`openEventActions`／`jumpToSection(registrationSection)`，同时保留安全举报入口 |
| 查看全部 | `jumpToSection(registrationSection)`，真实确认名单与读权限 |
| AI lightbulb／chevron | 原无业务onclick；当前“帮手尚未开放”，不能新造AI结论／自动导航或托管状态 |
| 分享活动 | `openShareCard`，与发布成功相同的身份／邀请资格门控 |
| 发送公告 | `openHostAnnouncement` 刷同event与identity后定位 `hostAnnouncementAnchor`；要求canManageAnnouncements、APPROVED、RECRUITING/CONFIRMED/IN_PROGRESS；不可用时查看真实公告区，不能自动post |
| 结束活动 | `canCompleteEvent`时 `openHostCompletion` 定位表单；招募／成局可取消时维持`cancelEvent`标题“取消活动”；其他状态进入签到管理。不能把取消或仅查看签到改名为结束活动 |
| 主办结项 | 保留 held选择、实际人数、异常／场地问题、complete；完整时间门控与独立反馈声明 |

保留 host 长页下部全部真实区域：协办授予／撤销／期限与scope、待回复事实、编辑草稿／已发布、公告问答与审核、share intention／归因和未知打开、通知失败跟进、口令轮换、预留席位、报名审批／移除原因／补记请求、人工成局、取消、动态签到、结项、AA输入精确到分、repeat草稿及候选同意。**这些不是源上部三按钮可替代的功能。**不能覆盖独立 `cohostApprovalSection/cohostContentSection/cohostCheckinSection`。

## 6. PG08 签到与反馈：几何、真实流程与凭证边界

### 6.1 源几何与差异

| 区域 | 源值 | 当前缺口／保护 |
| --- | --- | --- |
| header／segments | header64/横16；back44/icon24；title17/22/600、副标11/14显式500；more44/icon22/person32/18；mainpt64；inner16/gap12；segmented mt8/p4/rfull、selected p8×12/13/16/600 | 当前共用42px(rpx)导航、段钮rpx；需独立64实际offset，不改其他header |
| poster | r16/p12/bg#2F3034；photoopacity.30/mix-blend-screen/scale1.05；176蓝粉glow/blur64；SeeYou17/22/700italic−2°、InRealLife13/16/600−1°；brand11/14/900 | 当前participant min735rpx、p24rpx、photo.7/gradient不同，字号26rpx/20rpx；真实类型示意标签保持 |
| 原示意QR | 外232/p16/r22；内190×190/p8/r12；font11/14；centerA40；refresh mt12/p10×24/rfull/sync18，13/16/600 | 不能替代实际token QR。现主办canvas240px与encoder配合、实际服务端期限；不要只用CSS缩成190或叠中心A遮码 |
| 反馈卡 | p12/r16/gap12；heading17/22/700、question13/16/600；celebrationbox40/glyph22；choices2cols/gap8/p12/r12/13/16/600，selected700 | 当前card27×23rpx/r31、question23rpx、choice min78rpx；必要原因／提交／重试是R1真实扩展，不能为了原稿缺少它而删除 |
| 下一局／brand | CTA48/r12、blue→secondary→violet、17/22/700；footer11/14/700 | 现next-round88rpx/29rpx等；保留fresh IDEA语义与禁止复制发布 |

源 participant 显示假二维码与“离线可用”；源 host segment 只有前端切样式。源 countdown 初始文字9秒、脚本28→30循环，与服务端无关系；refresh仅修改源计时器。反馈按钮在源预选“举办／想参加”，JS仅换class，没有 POST。以上不能作为 R1 功能状态。

### 6.2 正确 Guard 与按钮映射

页面壳可以限定 `READY && activeSection==='checkinSection' && !successState && !joinConfirmation`，不能借壳扩大读写权限。PG08源是聚会屋顶、没有羽毛球标题；当前有 `display.isBadminton` 的类型配图分支。恢复同结构时保留羽毛球既有示意图与标签；非羽毛球仍复用屋顶原场景。若后续只实施源屋顶视觉，应再限定 `!display.isBadminton` 并保留羽毛球旧分支，不能直接把聚会图放到所有羽毛球活动。

| 分支／原意图 | 当前正确映射与守卫 |
| --- | --- |
| 参与者／主办方 segment | `selectCheckInMode` + `data-mode=participant/host`；host按钮仅canManageCheckins，切换clear旧token |
| 参与者“刷新QR”原位 | 当前角色实际为**扫描主办动态码**：`scanCheckIn`，或`checkInInput/checkIn`输入真实现场口令；只在`canCheckIn`开放，其他状态显示`checkInAvailability`。不能给参与者伪造可被主办核销的个人通行证 |
| 主办动态码 | `checkInMode==='host' && canManageCheckins`；按钮`showCheckInToken`只在canGenerateCheckInToken；token存在才显示`checkinQrScreen` canvas及真实expiresIn |
| 到场记录／补记 | 保留 EMPTY/FORBIDDEN/ERROR及attendanceRetryButton、checkIns实际evidence/time；本人PENDING才`respondManualCheckIn`确认／拒绝。扫码与本人确认补记是不同证据 |
| 活动未结束反馈预览 | `event.status!=='COMPLETED'`只预览，不能提交 |
| 结束后的独立反馈 | `COMPLETED && outcomeLoadState==='READY' && outcome && !isHost && myRegistration.status==='CONFIRMED'`；未提交才真实form；已提交保持记录说明。保留结项level/count/争议／人工复核与host私有issues |
| 举办／重复两问 | `setFeedbackHeld`／`setFeedbackWouldRepeat`，null起始，不预选；真实radio禁用 submitting/uncertain，源button外观不能丢掉checked/bindchange/disabled |
| 提交与原因 | `feedbackReasonInput` maxlength500；未举办原因必填；`submitFeedback` pins currentidentity/event/version +requestgeneration；网络不确定时重试**同一原反馈**，不重新编辑或冒充成功 |
| 再来一局 | `startAnotherEvent` 在真实COMPLETED/CONFIRMED成员/outcome可读/currentidentity下写本人fresh intent并switchCreate IDEA；不复制、不发布当前活动 |

`timedEventControls` 使用有效start/end，event CONFIRMED/IN_PROGRESS，签到窗口start−30分钟至end+30分钟（包含边界）；参与者需要CONFIRMED，生成者为host或CHECKIN_MANAGE协办。完成仅host且实际end已过。显示设备时间只是提示，服务端是最终校验。

`showCheckInToken` POST `/events/{id}/checkin-token` 带expectedVersion；结果期限减去网络耗时和1秒余量；异步回调验证requestid/actor/id/version/页面未隐藏及最新时间条件，过期清旧码自动更新。`scanCheckIn` 相机QR后重核窗口和token格式，再真实POST。不得加离线保证、固定30秒、永久有效二维码、个人静态二维码或假扫码成功。

## 7. PG09 AA：源几何、真实记录与隐私

### 7.1 原布局／当前差异

| 区域 | 源值 | 当前缺口／保护 |
| --- | --- | --- |
| header／页 | header64/横16/back44负左4/icon24；title17/22/600；subtitle11/14/700/secondary+soft/p2×8；share44/icon22，person32/18；mainpt64/innerp16/gap16/pt4/pb40 | 当前旧header/rpx，费用段intro与extra真实状态需保留 |
| hero | aspect4:3/p16/r16/#2F3034；black85→45→35%；receipt_long20；amount28/36/800；underline128×6黄；底p10/r12/black55/blur24/group18、text13/16/600/detailchevron15 | 当前hero最后生效min420rpx、padding31rpx、total62rpx/900、photo.67；真实ledger current/history/revision/status、总额与隐私必须留 |
| stickers／members | floatingnote−bottom16/−right8/p8×12/r8/rotate7；GOODFOOD11/700，GreatPeople11/800，WorthIt10/500；membersmt8/p16/r16/gap12；heading17/22/700，count11/14/700；sortp6×10/13/16/600/glyph16 | 无R1授权照片字段，不复制源8头像／人名／host皇冠；真实alias／fallback我友仍用当前数据 |
| rows／expand | rowp8/r12/gap12/avatar44；name15/20/700；amount17/22/700；paidlabel11/500/check_circle13；原前5后3hidden，expand p10/13/16/600/glyph18 | 当前实际默认4行/真实长度展开、排序、个人／host声明与差异；不能改成固定8人或“全额支付” |
| AI拆账／说明 | AIp16/r16/icon28/glyph16white；heading15/20/700；3cellp10/gap8；note p14/r12/info20/正文13relaxed21.125；sourcefixed280/140/60 | 费用分类／商户收据／AI拆账无R1数据，应保留当前真实revision/total/share明细与非托管声明；不把假分类塞进当前账本 |

完整源只有 expand静态成员和“查看明细”scrollTo360脚本；sort、header share、receipt图标本身无真实数据动作。source“账单已对齐”“已付清”不能从布局或当前 `RECORD_ONLY` 推出。

### 7.2 Guard 与真实映射

建议源AA壳限定 `READY && activeSection==='expenseSection' && !successState && !joinConfirmation && event.payload.feeMode==='AA'`；费用非AA与FREE下历史账本保护。READ空／错误／无权限分支保持，不让费用页面壳绕过`expenseLoadState`或伪造空账单金额。每份 ledger 保留独立id/revision/current/status，不能只恢复第一张并丢历史。

| 原按钮／意图 | 当前映射／数据界限 |
| --- | --- |
| 返回／person | `goBack`／`jumpToSection(registrationSection)`，不是个人主页 |
| 顶栏分享 | `shareCurrentEvent` 费用分区路由到`copyCurrentExpenseSummary`；它复制真实当前记录摘要，非假“支付完成分享” |
| 查看明细／receipt | `toggleExpenseDetails`，必须传`data-ledger=ledger.id`；显示真revision/status/total/可读份额数及无商户收据说明。receipt图标可作明细装饰，不能宣称收据可下载 |
| 排序 | `toggleExpenseSort` +ledgerid，真实金额排序／恢复原顺序；源没有handler不能删除现有真实功能 |
| 展开／收起 | `toggleExpenseMembers` +ledgerid，当前真实>4条件、实际len，非源固定5+3 |
| 本人已处理 | `markHandled` +ledger/user，只有current、本人、尚未记录；声明为`PARTICIPANT_HANDLED`，不等于支付凭证 |
| 主办已收到 | `markReceived` +ledger/user，只有current、host、尚未记录；声明为`HOST_RECEIVED`，仍非平台资金到账 |
| 无记录／错误 | EMPTY：真实hostAA可`jumpToSection(hostSection)`；ERROR：`refresh`（expenseRetryButton）；FORBIDDEN不泄露成员份额 |
| 输入／发布账本 | hostSection既有`expenseInput/expense`，十进制最多2位、safeinteger分、expectedLedgerRevision、服务端按已确认成员分摊；保留入口与真实失败状态 |

费用读权限为host或本场CONFIRMED/RECONFIRM_REQUIRED成员；**协办capabilities自身不能获得费用读权限**。host可读所有真实shares，成员只读自己；排序／人数／copy摘要不能扩权。每行保留participantHandled/hostReceived两套声明、pending/mismatch/current/history，旧版确认不代表同意新金额。

`copyCurrentExpenseSummary` 会refresh后再次核identity/event/version/当前费用分区/nooverlay、AA、READY、唯一current ledger、`RECORD_ONLY`、validid/revision/非负整数分。host复制前核唯一shareuser、整数份额、合计等于总额；member仅核并复制自己的唯一份额。又GET event核版本及host/feemode/title，clipboard回调仍pinscontext，避免切账号／切页／新revision泄露旧摘要。不得为source分享图标绕过这条真实路径。

当前费用说明的尾差规则需要完整保留：精确到分，固定成员顺序逐人分配无法均分的余下几分，各份额合计总额；不能用“总额／人数”平均展示取代逐行真实金额，更不能使 source ¥480/8/¥60 或280/140/60成为真实账单。

## 8. 真实入口与旧URL兼容

| 域 | 当前入口／参数 | 当前页再次核验 |
| --- | --- | --- |
| 发布成功 | create publish后 `/pages/event/event?id=...&success=published` | refresh后sameid+host+RECRUITING+reviewPENDING/APPROVED；PENDING文案仍真实 |
| 主办 | 首页organized管理、已发布成功CTA、create管理入口→旧URL `section=hostSection` | `sectionAvailable`只isHost，freshidentity/event |
| 主办签到 | 首页CONFIRMED/IN_PROGRESS host shortcut→`section=checkinSection&entry=hostCheckin` | sameid/currentidentity/isHost/canManageCheckins/eligible status；设置hostmode；真正生成再核时间窗口 |
| 普通签到 | itinerary `openCheckin`／活动入口→`section=checkinSection` | 成员状态／时间／服务端；不借entry强制生成 |
| 结项／反馈 | notices EVENT_OUTCOME_DUE→hostSection+hostCompletion，EVENT_OUTCOME_REVIEW→checkinSection+memberFeedback；首页history成员→memberFeedback | due真实host/time；review为COMPLETED/非host/CONFIRMED/outcomeREADY；定位form或已记录卡 |
| AA | 首页真实AA record shortcut→`section=expenseSection`；当前活动目的地按钮 | 费用read状态与host/member隐私再次核验 |

旧兼容 `event-entry.js` 会编码完整 string/number/boolean options后`redirectTo('/subpackages/activity/event/event?...')`，保留id/token/source/section/entry/success等查询参数，不改历史分享URL；生成真实邀请的分享仍沿用 `/pages/event/event?token=...&source=...`。入口失败只给通用加载失败和重试／返回，request序号与unload失活防止过期回调；redirect没有新加活动页栈层。上述是只读代码事实，本报告没有重跑 root 入口6测试或实际运行。

## 9. 现有照片复用与待证明资源

| 现有路径（不复制） | B | SHA-256 | 用途／来源界限 |
| --- | ---: | --- | --- |
| `/assets/stitch/pg04s_badminton.jpg` | 63131 | `8d4c18256599f7d9ab5ff629947156507b40da2315fd5e0b4a88434471c0bdbe` | 当前已发布羽球封面；历史Wave51记录为PG04_S HTML引用照片。本次核现有字节，未再次下载远程JPEG证明当前网络字节 |
| `/assets/stitch/pg08_checkin_rooftop.jpg` | 67426 | `1dac5da7892a3a5b77e078509de87f5e5d308f0d3b04aaefcd6773f059e6b541` | 现非羽球签到屋顶示意；历史Wave23有原稿与类型配图记录，不冒充本场现场照片 |
| `/assets/stitch/pg09_expense_rooftop.jpg` | 70223 | `169a9e7aad0497b32c48e9fca3e908c14a870d9cd023bbaed0351a899f85c77a` | 现非羽球AA屋顶示意；保留类型标注 |
| `/assets/stitch/itinerary_badminton.jpg` | 60640 | `6dff9b8ed669c73e1ee9ea1997af6c7da3383e59dd8ec1b32c516ddbdff6d7e7` | 现羽球签到／AA既有类型示意 |
| `/assets/stitch/caper_home_badminton.jpg` | 56146 | `df87413d3555b9f9b7cb7428a23ad2cbe1dad270fade6f53867ab29e29f2647d` | 现host羽球示意，不是PG06原URL的精确字节证明 |

三份可复用场景在现有 WXML 中真实引用。历史[PG04_S来源记录](caper-pg04s-reference-layout-wave51-2026-10-01.md)及[PG08/09类型配图记录](caper-pg08-pg09-scene-parity-wave23-2026-10-01.md)可追溯；其旧截图／通过数字不代表这次四页已恢复或验收。

PG06原hero URL以 `AB6AXuBJ5KYdLoeLgWLiWXSmUXx4Zps...` 开头；只在原HTML背景声明找到，现docs／assets没有该精确JPEG证明。PG08背景以 `AB6AXuB4-W6702WnQFxxv3znBnsO__rE1Q...` 开头；PG09以 `AB6AXuB1hSQp1LSL3Dn9dE7WjkO72uxrc...` 开头。完整URL可由已核HTML对应background-image获得；不要另写缩短URL当下载来源。PG06五张成员图片、PG09八张头像属于原稿示意身份；R1没有本场真实授权头像字段，本批不下载或复用假头像。

本审计新增运行资源 **0 B**。后续固定SVG可在activity分包增加必要字节，officialfont/来源证明保留docs；全局字体由root单独负责。复用JPEG路径不增加主包，资源移动与最终包体仍由root决定；本报告没有重新量包或用历史预算作现量。

## 10. 可分工域与共享文件风险

四页都在**同一完整 event.wxml/wxss/js**，不能给四个实现者同时直接写三文件。可并行划分如下域，但必须有单一产品合入负责人，其他域提交独立临时片段／来源记录／唯一前缀资产后统一合入：

| 域 | 可独立准备内容 | 合入边界 |
| --- | --- | --- |
| A 发布成功 | PG04_S全源映射、准确Material/56pxheader、PUBLISHED布局片段 | 只PUBLISHED源type guard；审核待审与资格分支保留；不改JOINED／报名确认／createFORM |
| B 主办 | PG06原像素、hero原stacking疑点、统计／roster／上部提示／shortcut片段 | 只hostSection指定状态/type；下部长页真实host表单不重写；协办分区保护 |
| C 签到／反馈 | PG08上部图形、64pxheader、participant/host真实形态、feedback原像素 | 凭证／时效／nativecanvas／反馈版本与不确定重试由共同JS负责人保留；无假QR导出 |
| D AA | PG09 4:3hero、真实ledger行/展开/明细/状态外观 | host/member权限与current/history多ledger保护；不改backend账本／资金语义 |
| root/shared | nativeheader、胶囊及anchors/scroll；当前共享JS与font模块、分包/旧入口/包体/最终运行 | 单一负责人；其他域不得重写共用success-mark/event-section/button/host-section或共享QRhelper |

建议分别用 `pg04s-* / pg06-* / pg08-* / pg09-*` selector前缀和明确scope class；源px写字面，viewport100%、native状态栏+56/64、safe-area与胶囊让位分别适配。现有headerPaddingRight helper可复用，不改statusBarHeight或业务；新增header必须避免与Wave66/Wave67已有header双显。长标题允许限定flex/ellipsis，不整体缩brand/glyph/按钮。

共用 `.event-tabs` 目前 `top:calc(statusBarHeight + 84rpx)`（42px），host公告／结项anchors现有−230rpx；不能直接在全局把42改成56/64或移动anchors以满足某一页。应按新增page scope使用实际header高度，并保留已有scroll目标id、`section-hidden`／success与join overlay的可见性。仅把section-hidden替成移除节点可能破坏selector定位与canvas生命周期。

共同JS保护点：refresh各可选区的READY/EMPTY/FORBIDDEN/ERROR、currentIdentity/currentActorId、事件expectedVersion和请求generation、invite资格、tokenclear与hide/unload、source归因、AA旧账本与clipboardattempt、反馈uncertain原payload、审批／手动签到／结项／repeat真实接口、所有失败提示与安全入口。视觉改动若没有具体新字段需求，JS应保持不变。

## 11. 尚未实施与下一步必要事项

1. 确定PG06原hero stacking异常的恢复取舍及首次host状态/type范围；未确定前不新造或下载背景。
2. 为四域每个必要Material节点核官方固定字形／axes／颜色与已有同源资产候选，source evidence放docs，运行SVG最小化；源假QR不进入产品。
3. 全局字体负责人处理PG08变量源900和PG09变量源500的真实可见文本需求，不能把现800/400称为该源精确weight；此审计未准备或接入新字体。
4. 单一合入负责人按上述guard完成限定WXML/WXSS；长页其余区域原样保护，必要native几何改动与理由单列。
5. 合入后按变动一次必要来源／资源引用／绑定／保护区域校对，再由root进行限定路由与必要运行验证；本报告不预称通过、不启动全量、不追加本轮已完成PG05/PG05_S重复检查。

本批只读已完成的范围为原稿身份／全部HTML与PNG阅读、8源entry字节校对、原有效px／图形与未定义token盘点、当前canonical实现和真实入口／按钮／状态保护的代码审计、可分工域与资源字节盘点。**产品恢复尚未实施。**
