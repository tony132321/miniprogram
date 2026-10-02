# Wave 67 — 下一批 PG10 四页原稿缺口与实施边界（只读审计）

日期：2026-10-02。范围：PG10-A 个人编辑、PG10-B 勋章、PG10-C 现场高光记忆（现工程 `moments`，任务所称成长记录）、PG10-D 隐私安全。

本记录只读比较用户原 HTML / PNG 与现有 profile 分包，不改产品、不执行业务测试、SDK、微信工具、编译或 Git mutation。PG10-C 不另创一张 XP 成长页；原 39 个设计页面的引用与身份保持不变。以下内容是下一批实施输入，不是本批 UI 已修复或 1:1 已验收的结论。

## 1. 原始来源与身份

用户 ZIP：`/Users/tsb/Downloads/stitch_design_system_generator (2).zip`。

SHA-256：`df22e733d33fda20979b75b8a7bc94717c4a5c9e41561a54e3038432fab32603`。只计非 `__MACOSX` 的 `*/code.html`，共 **39** 个源页面。

读取缓存：`/private/tmp/irl-stitch-original/stitch_design_system_generator/`。完整读取本表四份 HTML，查看本表四份 PNG；本次逐字节重核 ZIP 中以下八个文件与缓存一致。PNG 是原导出比例，不以图片像素宽度代替 HTML 的 CSS px。

| ZIP 内 `stitch_design_system_generator/` 后的路径 | 字节 | SHA-256 | PNG 尺寸 |
| --- | ---: | --- | --- |
| `pg10_a_edit_profile/code.html` | 22,207 | `3a237335c3861eab11574f5a3b0272f3fc902c0c51c151edfc9bd57e80e0c5fb` | — |
| `pg10_a_edit_profile/screen.png` | 215,687 | `3df4c4ed490eecbfd900df894f6d0687fb148662e757f52f82f2023477a1dbd7` | 589 × 1,600 |
| `pg10_b_social_badges/code.html` | 29,737 | `6bdd03d9c691ca3fedc1824c29eb38592ca60dc10384aca3437e0311f1ee4b0b` | — |
| `pg10_b_social_badges/screen.png` | 471,245 | `e8feb63c376df934bbb9247742ac849734b8cb77739a096a8b8c5b542b6a839c` | 622 × 1,600 |
| `pg10_c/code.html` | 29,565 | `cdf5a961530cf79b5678b45cef5dfb2347e6f5c0de442b871f5c6aba5bb49d5e` | — |
| `pg10_c/screen.png` | 686,754 | `836659cfbca0fac930e6bdef69955d9485aa752f361098e3a667c1444ad4352b` | 482 × 1,600 |
| `pg10_d/code.html` | 16,674 | `0c947827be5b24cf753dc84a06c3cd8fa9af3937be05cd4f9a7ac2cc981d4af2` | — |
| `pg10_d/screen.png` | 276,091 | `01158ae45ca5979f5680ad7cf7a9d422347df151e02669477596c24f0ec07dc8` | 780 × 1,302 |

### 源页 → 现有唯一落点

| 源页 | 产品页面 | 源 header 文案 | 本轮结论 |
| --- | --- | --- | --- |
| PG10-A | `subpackages/profile/profile-edit/profile-edit` | `Edit Profile` | 复用 Wave 60 布局、官方图标、真实活动昵称入口 |
| PG10-B | `subpackages/profile/badges/badges` | `Edit Profile` | 复用概念勋章与筛选 / 弹层 / 原生分享；授予闭态保留 |
| PG10-C | `subpackages/profile/moments/moments` | `Edit Profile` | 复用真实本人活动与 8 张示意图；样式缺口最多 |
| PG10-D | `subpackages/profile/privacy-safety/privacy-safety` | `Privacy & Safety` | 复用真实屏蔽列表 / 解除请求 / 举报路由 |

A / B / C 同名 header 是用户完整原稿事实，不自行改成新标题。D 现 WXML 为 `隐私与安全`，与原稿英文不同，下一批可恢复原稿字面文案。该差异不影响 API 或授权范围。

## 2. 已有实现与共用约束

四页都在既有 profile 分包内。`common.wxss`、`navigation.js`、`app.json`、主包字体 loader / data、全局样式与活动旧 URL 转发由根代理统一管理，不属于四页实施者的可写范围。四页 `*.json` 已是 custom navigation，当前不需要重建页面或分包。

已复用材料：A 19、B 19、C 17、D 9 条现有 Material Symbols 资源 manifest 记录（共 64 条，不是 64 个独有字形）。官方固定来源为 Google `material-design-icons`，固定 commit `bd8cb85bd4bad964fe6918f79665bb40c3a8efef`，Apache-2.0；对应 manifest 记录 source / asset hash、颜色和 FILL。D `report.svg` 的真实 `report_problem` font glyph 另有 `docs/design-sources/material-symbols-report-problem/` 来源证明，继续复用该准确资源，不画替代图形。C 原 8 张 JPG 已在 `moments/assets`，`reference-sources.json` 明确是设计示意，不是本人真实相册；无需重复下载、替换图片或改变画质。

共同原稿明确使用 Plus Jakarta Sans：`body` 的 `font-body-md text-body-md` 为 **15 px / 21 px / 400**。主要实际节点为 headline-sm **17 / 22 / 600**、headline-md **20 / 26 / 700**、label-lg **15 / 20 / 600**、label-md **13 / 16 / 600**、label-sm **11 / 14 / 700**、body-sm **13 / 18 / 400**。`font-label-sm` 是 family token，尺寸由 `text-label-sm` 提供；不能据 family 名字猜尺寸。

原四页 header 都是源 `bg-surface/85`、`backdrop-blur-xl`（24 px）、`shadow-[0_1px_8px_rgba(0,0,0,0.03)]`；内容高 **56 px**、侧距 **16 px**、返回 / more 最小点击区域 **44 px**、右头像 **32 px**。当前四页没有 header `backdrop-filter`；A / D 已有对应 rgba 与阴影（在 375 px 处 rpx 换算成立），B 已有 rgba、C 仍继承旧共用背景，不能为此覆盖整个 `common.wxss`。

现有样式大多用 `2rpx = 1px at 375px` 的旧恢复方式。原 HTML 有效值是固定 CSS px；在 320 / 390 / 414 px 视口，现 rpx 不等于原固定 px。下一批应只在各自源区域恢复有证据的 px、相对照片比例和源 max-width，保留已存在的 native capsule inset、状态栏背景、sticky header、菜单锚点、滚动 / 关闭时机与 `env(safe-area-inset-bottom)`。原 body 的 `max(884px,100dvh)` 不是把所有内容硬锁为 884 px 的理由。

### 字体与图标轴边界

当前根代理字体资源 metadata 是 Caveat 700、Jakarta 400 / 600 / 700 / 800、Rubik Mono One 400；loader 已 `global:true`。**A `edit-page` 与 C `moments-page` 及其共用祖先都没有 font-family**，因此“字库已加载”不等于这两页已使用源 family。B / D 已声明 Jakarta。A `.bio-heading text` 和 C 示意叠层等实际 CSS 仍有 500；源 C 的场地 span 也是 `font-medium`。当前没有准确 Jakarta 500 静态 face；如下一批保留这些源 500 节点，应由根代理决定最小准确字体策略，不能由四页代理改 loader、以 600 假称 500，或在未渲染时宣称字形通过。

另一个独立待核点：四源 header 的 `arrow_back_ios_new` span 都有 `text-[24px] font-semibold`，源 Google CSS 请求 Material outlined 可变 `wght 100..700`；现各页 manifest 的 `sourceAxes.weight` 为 400、opsz 24、GRAD 0。现证明足以追溯这份 400 静态 SVG，**不能单凭它证明 source 600 节点轮廓相同**。这次未下载 / 绘制 600 图形、未比较字体插值或实际渲染，故标记为下一批准确轴验证项，不将未知形状差异宣称为已验证 bug，也不替换其它已准确命名 / 路径 / FILL 的图标。

## 3. 确认的视觉缺口与最小恢复建议

只列存在原稿和产品位置证据的项。演示人物、数字、授予、相册、点赞等 R1 闭态差异另列第 5 节，不以虚构数据换取截图相似。

### A — 个人编辑

| 项目 | 原稿有效值 / 位置 | 当前位置 / 差异 | 最小范围 |
| --- | --- | --- | --- |
| family / 默认 body | 源 body Jakarta 15 / 21 | `profile-edit.wxss:34` `.edit-page` 无 family，`common.wxss:1` 也无，`app.wxss` 16 px 无 family | 页面自身 family / body scope |
| 头像环境光晕 | `pg10_a_edit_profile/code.html:25`，144 × 144 px，to-tr violet 20% / blue 15% / lime 20%，blur-2xl 40 px，-z10，pointer-events-none | WXML 没有这层，现 `.identity-avatar` 仍为真实闭态匿名头像 | 在自身头像层恢复原光晕，不换匿名身份 |
| header blur | 24 px 源 header | `profile-edit.wxss:35` 与 `:95` 有 rgba / shadow / sticky，缺 blur | 限 `.edit-page .pg10-header` |
| 字体与固定 px | 源 bio-counter 为 font-medium 500，源固定 token | `:58` 闭态文本保留 500，主体多为 375 px 校准 rpx | 明确节点 family / weight；必要准确 face 由 root 统筹 |

现编辑卡 padding 12 px、radius 12 px、source shadow-sm，在 375 px 已匹配；兴趣区的实际 16 px 间距与原 `space-y-3` 12 px + `pt-1` 4 px相符，不应误改成单独 12 px。头像区域的 parent gap / pt 应完整累计后再改，不凭单条 padding 认定偏差。

### B — 徽章 / 成长印记

| 项目 | 原稿有效值 / 位置 | 当前差异 | 最小范围 |
| --- | --- | --- | --- |
| summary 两环境光晕 | 源 HTML `:26–27`，176 × 176 px，top/right −40，bottom/left −40，primary10% / lime20%，blur40 | WXML 缺两层 | `.badge-summary` 内准确装饰层 |
| summary shadow | 源 `:25` `shadow-sm`：0 1px 2px rgba(0,0,0,.05) | CSS `:16` 旧 0 6rpx 18rpx rgba(39,58,116,.05)；`:91` 未覆盖 shadow | 页面自身 source shadow |
| 勋章 halo | 源 `:147` 等 `blur-md` = 12 px | CSS `:119` `blur(16rpx)` 在 375 仅 8 px | `.badge-halo` 准确 12 px |
| 卡 / 勋章本体 shadow | 源卡 `shadow-sm`；圆角图形 `shadow-md` = 0 4px 6px −1px rgba(.1), 0 2px 4px −2px rgba(.1) | CSS `:41–42` 旧 shadow 保留；`:116/:118` 未覆写 | 准确对应卡 / 图形，不改未授予事实 |
| summary orb | 源彩色壳 shadow-lg + primary20%，内层 `backdrop-blur-sm` 12 px | 旧 orb shadow 延续、`:94` 内层无 blur | 壳 / 内层原 CSS，XP 数字继续闭态 |
| fixed share / detail 容器 | 源 `:289` max-w-md448，`:254` modal max-w-lg512；bottom sheet 原双按钮「关闭 / 挂载展示」 | CSS `:139–145` 无448 / 512限宽；目前顶部 close + 单个真实活动入口 | 先限宽 / 原结构；如恢复底部双按钮，关闭接现 `closeBadge`，佩戴必须 disabled / 待开放；保留真实活动入口 |
| header | 源 rgba / blur24 / source shadow | 当前 rgba 已有，blur 与源 shadow 没有完整覆盖 | `.badge-page` 私有 header |

当前 lime 图形容器继承旧 `color:#253000`，但实际 SVG 的 root fill 独立控制图标颜色，不能据容器 color 就宣称实际 glyph 颜色偏差。下一批以 material manifest 与实际 SVG 为准；不对已准确官方图标重复画图。

### C — 现场高光记忆 / 成长记录（优先恢复）

| 项目 | 原稿有效值 / 位置 | 当前产品位置 / 值 | 最小恢复 |
| --- | --- | --- | --- |
| 页面色 / family | surface `#faf8fe`、on-surface `#1a1b1f`、Jakarta body15/21 | `moments.wxss:2` 未覆写，共用 `:1` 继承 `#f8f7fc/#171a24` 与系统字体 | `.moments-page` 自身 scope |
| header | 源 HTML `:10` rgba .85 / blur24 / source shadow | 当前 `:4` 仍继承共用 `#faf9fd`，缺 source blur / shadow | 私有 header，保留 native inset |
| filter | 源 active blue `#1d64f2`；inactive container `#efedf3`、variant `#424655` | 旧 active `#2164f0`、inactive `#eeeef5/#3d4657` | 准确 token，不改 filter id / 数据 |
| 摘要渐变 / 光晕 | 源 `:32–33` to-right `#ebf2fe→#f2f1fd→#fff0f3`；96 px lime20% halo，right−16 / bottom−24、blur24 | `:20` 115deg `#eaf2ff/#f7f0ff/#fbf5d8`；缺 halo | 原 layers，保留真实活动计数 / 闭态说明 |
| 摘要副文案色 | 源 body-sm variant `#424655` | `:26` `#596579` | `.summary-note` |
| 卡 shadow / title / meta | 源 shadow-sm，title `#1a1b1f`17/22/600，meta `#424655`13/18 | `:30` 旧蓝灰 shadow；`:34–35` `#141922/#626d80`；字号375校准正确 | 原 token / shadow，数据不动 |
| 图标到标题间距 | 源 `:64` 内分组 `gap-2.5`10 px | `:31` `gap:13rpx`（375处6.5 px） | 原10px，保留右侧 pack 待开放 |
| 大图 caption | 源 `:87` top / left10px，on-background70% + blur12，px8 / py2、label-sm11/14 | `:44–46` top / left7px、rgba(15,23,42,.76)，正文9px且未使用源blur | 准确源图层，示意 / 相册闭态文字保留，不将固定示意照伪装用户照片 |
| AI 区 | 源 `:265–279` to-br violet-soft→white→blue-soft，p12/r12；图标白圆40、glyph22；headline17/22、body13/18 | `:55–59` 110deg紫→淡蓝；p10/r12.5；圆26.5；标题11px、描述9px | 恢复原组件层级，操作保持非可用闭态，原绿色在线点不能冒充已启用 |
| 固定 CTA | 源 `:282–290` 外渐隐层、max448、h52、blue `#1d64f2`、gap8、label15/20、badge11/14 | `:63–65` h52在375正确；旧共用 primary `#2465ef`、gap6、badge8.5px、无max448 | 只恢复源尺度 / 颜色 / 容器，继续真实 `goCreate`；不绑定虚假照片上传 |

C 的 badminton / picnic / boardgame collage 已按源不同照片比例实现，C8张原 JPG、原图 crop 与比例可继续复用。原 sticker「GOOD GAME!」「GOLDEN VIBES」「MVP WINNER」及 L/K/J 等人员、点赞 / 相片数，在当前真实活动卡上并不代表实际事件；恢复装饰前必须明确其属于设计示意，不能将胜出 / 人员 / 用户内容编进真实投影。闭态 footer 是新增诚实信息，不要求把原数值直接抄入。

### D — 隐私安全

主要 source token / hero / 黑名单卡 / help / empty geometry 已在 Wave60 按375px恢复。hero 的144px光晕已存在；padding16、卡padding12、avatar48、空态64圆、typography主要节点均可复用。

确认剩余项：源标题英文与现中文不同；header blur24缺失；固定px / 源family继承需在新视口核查。**真实黑名单数量、活动来源、解除 pending 状态不替换成原两个演示人物、头像、日期、屏蔽原因**。源“可左滑管理”在当前没有 swipe 实现，现“可逐条管理”是正确闭态说明，不能仅为字面复刻宣称手势可用。

## 4. 数据 / 按钮对应与保护范围

### A 个人编辑

现绑定：`back`、`toggleMore`、`goProfile`、`goActivities`、`goPrivacySafety`、`goLegal`、`goCity`、`openAliasPicker`、`closeAliasPicker`、`goAliasActivity`、`goPrivacyRequests`。

- `openAliasPicker`：真实 `GET /me/events`，host 或 `CONFIRMED / RECONFIRM_REQUIRED / WAITLISTED / OFFERED` 项投影；LOADING / UNAUTHENTICATED / EMPTY / ERROR / READY 保留。
- 请求 id、session userId/token（或既有development identity）、visible / onHide / 当前 session 的隔离守卫保留。不是用全局静态昵称伪造。
- 选中实际 candidate ID → `/pages/event/event?id=<encoded>&section=registrationSection&entry=alias`；当前活动旧URL与根代理后续真实转发是同一导航合同，不由个人页代理改路由。
- 城市 → 既有 `pages/city/city`（真实浏览城市）；“我的活动” → `moments?filter=all`；隐私 / 法律 → 各实际分包页。删除请求 → profile 的 `privacySection` 聚焦，继续实际请求入口。
- 全局资料 / 头像 / gender / bio / interest persistence / WeChat visibility 不是可写能力；UI继续 view / disabled / 待开放。

### B 勋章

现绑定：`back`、`toggleMore`、`goProfile`、`goPrivacy`、`goActivities`、`selectCategory`、`openBadge`、`closeBadge`；另有 `open-type="share"` 及 `onShareAppMessage`。

- category id 校验后筛9个**概念**：all / sports / social / organizer / explorer。不能使用源 “28枚” 冒充用户已获徽章。
- 勋章 id 校验后开 detail，关闭、onHide close、菜单关闭保留；4空展示位未可佩戴。
- 原生分享已经是「勋章墙概念预览（尚未开放）」与本页真实 path，不是朋友圈海报生成，不复制原JS toast“已分享到朋友圈”假成功。
- 真实活动入口 → `moments?filter=all`，实际 profile / privacy 路由保持。UI结构恢复无需重写 badges JS。

### C 活动记忆

现绑定：`back`、`toggleMore`、`goProfile`、`goPrivacy`、`goGuidelines`、`refresh`、`selectFilter`、`openActivity`、`showAllActivities`、`goActivities`、`goCreate`。

- `GET /me/events` 真实items投影；`all / participated / hosted`（现id与method不改），第四“胶片合影”筛选闭态。日期由真活动时间 +8时区投影，不复制原演示日期。
- session身份 / generation守卫、onShow清除旧list、identity变化清空 / resetfilter / closemenu / message、当前 visible真实ID导航守卫保留。
- 标题 / 场地 / 主办身份 / enrollment状态 /审核和募集状态来自实际item。活动详情统一走 `/pages/event/event?id=<encoded>`；菜单隐私 / 社区准则是实际目标。
- 空态前往首页与底部发起新活动是真实 `switchTab`，继续复用；示意collage/详情按钮打开同一真实活动，不触发照片操作。
- 相册、照片数量、点赞、评论、下载照片包、照片投递、AI人脸识别均没有真实API，不能因原HTMLonclick示例改为假local成功。

### D 隐私安全

现绑定：`back`、`toggleMore`、`goProfile`、`goSupport`、`goLegal`、`goReport`、`retry`、`revokeBlock`。

- `GET /me/blocks`，generation + actor身份防旧响应；数量仅READY真`blocks.length`。签出 / 加载 / 失败 / 重试 / 空态完整保留。
- `POST /me/blocks/<encoded id>/revoke`，READY / actualid / revokingId / currentactor守卫；调用后真实重载列表，身份变化不透出旧用户数据；不先乐观删卡或提前声明成功。
- `goReport` 写已存在 `irlProfileFocusIntent=reportSection` / 真实owner上下文，跳profile实际举报区；support / legal是实际页面，不编造私聊客服。
- R1屏蔽真实作用是共同成员昵称列表互相隐藏、邀请候选排除；不复制源 “广场双向隐身 / 私信隔绝” 作为已支持功能。

## 5. 原稿示例与 R1 必须保留的闭态

| 页 | 原稿含有但非当前 R1 真实能力 / 数据 | 必须保持 |
| --- | --- | --- |
| A | Léo头像 / handle、资料保存、资料输入持久化、global identity、gender / bio / interests、学校等级与资历、WeChat visibility ON | 匿名当前身份、保存暂未开放、示意未保存、未验证、待开放；真实活动内昵称入口和浏览城市 |
| B | Lv.3、860 / 1000、86%、MAX-XP、已佩戴、28枚、获得日期 / 授予人 / XP奖励、挂载佩戴、朋友圈poster成功 | 没有 earned badge / XP；概念选择 / 原生概念分享可用，授予和佩戴关闭 |
| C | 12个瞬间 /128照 /356赞、示例人物与日期、现场照片包、likePhoto、uploadSheet、AI face、原示例赢家标签 | 仅真活动与真身份、示意原照标签；照片与AI未开放；真实详情 / 发起活动导航 |
| D | 演示黑名单2人 /人名 /头像 /原因 /日期、左滑、广场或私信双向隐藏、示例客服 | 真屏蔽数据与请求；仅R1实际授权作用；真实举报 / 支持入口 |

这类差异是实现产品合同的必要状态，不能列为“未抄示例数字所以功能未完成”。也不能借闭态之名保留与真实能力无关的旧视觉颜色 / 小字号 / 光晕缺失。

## 6. 可独占的下一批实施拆分

| 并行任务 | 可写范围 | 共享只读 / 必须保护 |
| --- | --- | --- |
| PG10-A | `profile-edit/profile-edit.wxml`、`.wxss`、仅确需准确新glyph的该页assets、独占evidence | JS原bytes优先保留；alias请求 / 过滤 / 状态 / 身份 / 关闭 / 真路由不改 |
| PG10-B | `badges/badges.wxml`、`.wxss`、该页必要准确assets、独占evidence | JS原bytes优先保留；9concept/categories/idguard/share/onHide保持；闭态佩戴 |
| PG10-C | `moments/moments.wxml`、`.wxss`、该页必要准确assets、独占evidence | JS原bytes优先保留；真GET/filters/身份隔离/真实ID; 8JPG原bytes与示意说明 |
| PG10-D | `privacy-safety/privacy-safety.wxml`、`.wxss`、该页必要准确assets、独占evidence | JS原bytes优先保留；GET/revoke与report/support/legal保护 |
| 根代理 | 必要准确500face / glyph-axis策略、主/分包预算、共享navigation / common / fonts / app配置、Developer Tools关键页面与Git发布 | 各页freeze后只一次必要局部验收，不以新增源码字节替代实测编译预算 |

本批无需新增真实业务API。若源组件恢复确实需要新纯展示字段，先明确来源、只追加projection，并按原业务methods/写入/identity区逆向字节证明；不扩展活动逻辑或读写路径。只验证实际新scope、准确source值 / 原资源 / 绑定和必要几何；不写实现镜像测试，不重跑既有全量 / CI / 既有不受影响VM。真实字形、viewport、native capsule、safe-area与点击链仍由根代理实际工具验收，不能由本只读审计代替。

## 7. 审计时产品快照

这是本次只读观察值，不冻结他人后续授权变更。页路径前缀为 `miniprogram/subpackages/profile/`。

| 文件 | 字节 | SHA-256 |
| --- | ---: | --- |
| `profile-edit/profile-edit.js` | 5,210 | `2fe8db9e0ca20e5be74c78a3289da0a99c92a962483fa41e72b97c08d8b8be70` |
| `profile-edit/profile-edit.wxml` | 8,690 | `42d609fc13afc1060bbe2580756840fe383bc2f886733301028661c11cbcde39` |
| `profile-edit/profile-edit.wxss` | 11,837 | `21c396330f448da8b55e4f1a85bcfcb1e0998bbfa6ecc4861069d7d08609c890` |
| `profile-edit/profile-edit.json` | 69 | `2be9acff05f45514df7b25f6468ef08060496ddd4944ffde92ca1e52360eedc0` |
| `badges/badges.js` | 4,094 | `0d3f2b9bd5b83f5dd05db67538da58a6bc219192a4681491ace56d1d6e375452` |
| `badges/badges.wxml` | 5,481 | `57e60e66f91fc822477017c7d66378841e5f668045058947365cf6114bebf6fe` |
| `badges/badges.wxss` | 17,289 | `2a43b1be9b241dbf4e197c15fe4db803c7a4e781ba9dcf5df22facc380d339b2` |
| `badges/badges.json` | 69 | `87e891486bff9a8628468a9e96bfa072f93cde60df20d41b4f8c839e41f4b8b3` |
| `moments/moments.js` | 8,564 | `8b067cadb3bd9b127fd700712f138fe4ab26d4e832dc469e1817663bf4deacdb` |
| `moments/moments.wxml` | 5,707 | `bffe4c9e2d82c56c97243f09a36ce5f05c4bfdccb44fb3a485b950ac1b7aa5c3` |
| `moments/moments.wxss` | 10,889 | `28bcdee358c4dff86cd2397a7a9bc4729028e5884f25402d224f4e6bb05a11dc` |
| `moments/moments.json` | 69 | `e52785ddb393f087f62846072ae5780bba40241f2c11adfbf6b9bd5d481eea6f` |
| `privacy-safety/privacy-safety.js` | 4,209 | `f2da6b103cea1f88f6a9654a55708b94a0965cc9fefbf154064173f0afee37f2` |
| `privacy-safety/privacy-safety.wxml` | 4,325 | `ba1e711c70e64d703a5f8aaf3f409e85009987d5a8b9526d6774edc7f1917524` |
| `privacy-safety/privacy-safety.wxss` | 8,279 | `bb70422dd3c34263e00a6b7a74d662943b256ed569155874d35ea3e36324dd98` |
| `privacy-safety/privacy-safety.json` | 72 | `972185002186d9aa40df4e9dc00f759cbe0cccace11722e876ad53d0259ed4b3` |

结论：四页继续复用现有功能、官方图标与原图片。下一批准确 UI 恢复优先 C、其次 A / B，D 为少量原 header / 字面 / 跨视口收尾。本次只读完成 source / 当前实现 / 闭态 / ownership 盘点，未宣称渲染、实际字形、API行为、按钮链或项目整体验收已经通过。
