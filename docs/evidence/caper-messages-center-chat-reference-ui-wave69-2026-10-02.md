# Wave 69 — PG02-N1 通知中心与 Alex 私聊关闭态

实施基线为 Wave 68 `2e3e027`。范围仅 `pages/messages/messages.wxml`、`.wxss`、23 个页面 SVG 与本文件／来源证据。JS、JSON、INBOX 与旧 CSS 保护范围未改；未新增依赖、全局字体、接口或业务处理。

## 原稿与实施范围

已完整阅读 N1、Alex 原 HTML 与上一批三屏差距审计，并实际查看两份完整 PNG。两份 HTML／PNG 与用户 ZIP 对应条目逐字节相等，文件大小及 SHA 见 `caper-messages-center-chat-reference-sources-wave69-2026-10-02.json`。截图导出尺寸 435 × 1600／616 × 1600 不作为 CSS viewport；全部新增尺寸使用原 CSS px。

| Scope | 本批恢复 | 数据／能力边界 |
| --- | --- | --- |
| `.messages-center-reference` | N1 的 56 px 页头、Event Detail 原标题、28/36 通知标题、未读 badge、已读按钮、横向四筛选；16 px 卡片内边距、12 px 卡间距／圆角、4 px 提醒渐变、32 px 分类圆图标、17/22 标题与13/18 摘要、64 px 提醒配图、审批条及 CTA、96 px 位置预览占位、成局渐变条与40 px 页尾圆标 | 只展示真实通知与报名申请。未提供联系人资料、真实头像、地图坐标、费用通知或付款能力，未复制示例人名、时间、金额、群聊及 AI 预约承诺。筛选未读示例 2／1 不冒充实际数量。 |
| `.messages-chat-reference` | Alex 的64 px 页头、Private Chat 原标题、40 px 泛化头像、56 px 场景图卡、安全提示、原返回／人物／工具／填充盾牌／输入栏字形；64 px composer 行、44 px 附件与语音按钮、44 px 输入容器和32 px 表情控件 | 既有 `CHAT_UNAVAILABLE` 继续显示真实关闭说明，未制造 Alex 资料、在线点、聊天记录、反应计数、快速输入或发送能力。输入／语音／表情／附件／通话与会话工具均 disabled，没有新增事件处理。 |

PG02-N2 的紧凑布局未实施，未增加切换器，也未把 N1／N2 计为两屏验收通过。本批是 N1 的真实通知结构和 Alex 的关闭态外围恢复，不声称原稿所有示例内容／图片或全部39屏逐像素完成。

### 原稿声明与有效 CSS

- Jakarta 只使用现有 `Plus Jakarta Sans` 400／600／700／800 faces。N1／Alex 的原请求均不包含500；没有引入 profile 的专用500别名。
- 原 `space-lg=16`、`space-md=12`、`space-sm=8`、`space-xs=4`、`space-xl=24`。卡片、header、CTA、caption 与 composer 均转换为原 px，未复制 rpx 尺寸。
- N1 原 `active:scale-98`、两个原稿中的 `backdrop-blur-xs`、Alex `rounded-tl-xs`／`rounded-tr-xs`、原 `py-0.2` 无有效 Tailwind v3 定义，未自行补值。source `min-h-screen` 有效优先于低 specificity 的884 px body，未固定截图高度。
- Alex `leading-tight` 对17 px标题有效为21.25 px；安全提示13 px `leading-relaxed` 为21.125 px，关闭态说明采用原会话 body 15 px／24.375 px。原 main `pb-24=96px` 与内层 `pb-6=24px` 均保留，再加 native safe bottom。

### 原生适配与图片

真实 `statusBarHeight`、`capsuleInset` 保留原 JS 推导。页头 `top` 使用前者，右侧预留后者；原网页 safe header 由真实状态栏取代，未再画状态栏。CENTER 56 px 与 CHAT 64 px 行高不缩放。

Alex 原 header 的3个44 px工具与32 px泛化人物圆标，在真实胶囊挤占宽度的情况下放入紧随 header 的独立禁用工具行，保留原 touch／glyph尺寸；这是明确的原生位置适配，不声称与浏览器原稿同一水平行。工具不含新绑定，无假通话。

N1／Alex 原示例球馆照片没有加入 main。继续引用既有 `caper_home_badminton.jpg`（56,146 B，SHA `df87413d3555b9f9b7cb7428a23ad2cbe1dad270fade6f53867ab29e29f2647d`），两处均明示“示意配图”。该照片不是这两屏原图，也不是当前活动的真实照片。位置预览没有地图数据／坐标，96 px banner 明示“位置预览尚未开放”，真实 CTA 保持查看实际最新安排；复制按钮保持“复制地点”，没有承诺导航启动。

## 准确 Material 来源

原稿最后加载的是 `Material Symbols Outlined:wght,FILL@100..700,0..1`，覆盖较早同 family／style 的 opsz 范围 face。取官方同一请求并只限制 `icon_names`；Chrome UA 返回 FILL 0..1／wght100..700 变量 face。无 opsz／GRAD 变量，固定24／0。图标 span 的 `.material-symbols-outlined` 自身 `font-weight:normal` 有效，故实例为400，不继承周围600／700文字。

官方 CSS、8980 B WOFF2、decoded TTF、请求 URL／SHA、逐 glyph SVG 路径和坐标均在 `docs/design-sources/caper-messages-wave69/`，均为 docs-only，不进主包。23 个 SVG 共16,657 B，`SVGPathPen` 保留准确轮廓，Y翻转，未舍入／简化。安全 `verified_user` 原 inline FILL1；实例化后实际应用选中的 `rclt` lookup1（`uniE8E8 → glyph00012`），使用正确填充轮廓，其余 FILL0。viewport 为原 UPEM 方格，尺寸、色值随原节点记录。许可复用既有 `docs/licenses/material-symbols-Apache-2.0.txt`，无新增字体运行负担。

## 一次必要的源码／绑定保护检查

`/private/tmp/caper-wave69-messages/check.py` 的限定检查已经完成。检查工具最初对分段 WXML 多补一个外层闭标签而报错，修正工具分段计数为完整解析后的分支祖先计数后通过；不是产品编译／业务错误。未运行 VM、业务测试、全量测试、CLI、SDK、微信或 Git mutation。

- WXML 完整解析；全部实际 action 的标签、`bind*`／`catch*`、`data-*`、disabled、id、aria-label 和 `wx:if`／循环祖先条件与基线逐项相等。INBOX 21、CENTER 19、CHAT 4 个 bindtap 保留。
- INBOX 完整 markup 前缀仅逆除外层模式 class 后恢复基线相等；原33,781 B CSS作为完整前缀逐字节相等。追加选择器只作用 CENTER／CHAT 模式，无 INBOX 或 global 泄漏。
- JS 30,759 B，SHA `799d2a61281dbb9ffceca63d2fe86a467201ef6de88543c40887ecfd1f2de1e3`；JSON 63 B，SHA `b76e69c65eadf25397e0df5c9457c5a098c1bfc714ae05be5441318bdc8ebacc`；均与基线字节相等。
- 23 SVG 均实际引用，路径存在，SVG path／颜色／viewport 与来源 manifest 一致；原稿两组 HTML／PNG 和 ZIP 条目相等；新 CSS 无 rpx、无 profile500别名；输入仍 disabled，无新增发送／输入事件。
- 检查后仅补两个明确来源细节：原 input placeholder 色 `#737687`、Alex 内层24 px底部间距。仅定点逆除这两改动，分别恢复上述完成检查的 WXML／WXSS SHA，没有重跑完整 checker。

定向证明及最终产品 hash 见 `caper-messages-center-chat-binding-proof-wave69-2026-10-02.json`，冻结清单在 `/private/tmp/caper-wave69-messages/frozen-owned-paths.json`。main raw 净增 **43,560 B**，小于本批90 KB上限；这是源文件／资源增量，最终编译主包由 root 实测。

## 真实动作前置条件与待根验收

| 动作 | 保留的真实前置条件／目标 |
| --- | --- |
| 通知中心／私聊返回 | `backToInbox`，恢复 INBOX 与五 Tab显示。 |
| 通知设置 | `goNotificationSettings`，guard实际identity，设置 focus 后进入我的页。 |
| 全部已读／四过滤／加载 | READY与真实未读状态；既有服务端 open-all、ALL／ACTIVITY／INTERACTION／SYSTEM、分页与 stale／error处理不变。 |
| 单报名通过／详情 | 实际 `registrationId`、`expectedVersion`、`canApprove`、`approvingId`；详情带真实 eventId 及 host／cohost section。没有批量通过或假名单。 |
| 单通知 CTA | 当前通知 id／kind／event_id／actionSection 与实际集合匹配；进入真实同场详情、签到、结项或个人处理记录，并执行原已读链路。 |
| 复制地点 | 当前身份及 request generation、CONFIRMED报名／accepted_version、活动同版本／状态／审核；复制真实 city／venue；隐藏时原失效机制仍保留。 |
| 关闭私聊两个实际去向 | `goMyActivities` 进入真实 profile moments `filter=all`；`openNotificationCenter` 进入实际 CENTER。其余 composer／通话／工具无动作。 |

root 后续负责真实 API 3037 身份与数据的 scoped CENTER点击、Alex disabled／返回渲染、源字号字形与 native geometry、CLI编译及主包上限、独立 source review 和 GitHub提交。本报告是源码／绑定／素材证据，不把 SDK 或源码检查当成原生实点、真机、生产服务或全39屏像素验收。
