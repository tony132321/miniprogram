# Wave 68 — PG10-A / PG10-B 独立来源与路由审查

日期：2026-10-02。审查者与 A / B 实施者不同。本轮唯一写入是这份审查报告；PG04-S、A / B 产品、其他代理证据、共享字体、配置、矩阵均保持冻结。未操作 Git、微信、CLI / SDK，未运行实施者的 101 项检查器或任何测试 / 全量。

## 结论与证据边界

**未发现本次 A / B 冻结实现需要整改的来源、CSS 级联、闭态语义或路由绑定问题。** 两份完整 HTML / PNG、当前完整 WXML / WXSS / JS，以及共享 `common.wxss` / `navigation.js` 已独立读完。源演示身份、荣誉和能力按真实 R1 边界替换为匿名 / 待开放状态，源组件、准确图形与有效固定 px 保持；新增弹层不引入授予或佩戴能力。

这是一份静态来源和绑定审查，不是当前微信像素、点击、字体加载、胶囊避让、跨 viewport 或包预算验收。根代理负责本轮定向运行取证。实施者报告的 101 项通过属于其原局部检查，未在此重复执行，也未作为独立运行结果计数。

## 阅读与初次冻结对象

以下完整审查记录保留初次 snapshot。提交前的唯一 alias 作用域订正及最终冻结 hash 见末尾「最终 500 alias 定点复核」；未重跑完整审查。

已读 [本轮计划](../superpowers/plans/2026-10-02-profile-four-and-published-reference-ui.md)、[四页只读来源审计](caper-next-profile-reference-gap-audit-wave67-2026-10-02.md)、[A / B 实施证据](caper-profile-edit-badges-reference-ui-wave68-2026-10-02.md) 和 [结构化记录](caper-profile-edit-badges-reference-ui-wave68-2026-10-02.json)。审查实际对象是实施者冻结清单 `/private/tmp/caper-wave68-profile-ab/frozen-owned-paths.json`，1,687 B，SHA-256 `62e2b5e396a1bd9edb8f2725d4bd9a18f87d543f5cdc6a0670b8d6f216c64e4f`。

独立读取并计算当前 9 条清单路径，**每条字节数 / SHA 均与 freeze 相符**。7 条产品记录如下；另两条实施 MD / JSON 的 SHA 分别为 `5774105074437ead79ea76e8b22b3f57c94f631b0d7b1acc1cdfe45941c9983a` / `34f5d19451638d9f40e53218e39e78600558418af03a201b0b5a619c673c5522`。

| 产品路径（均位于 `miniprogram/subpackages/profile/`） | B | SHA-256 |
| --- | ---: | --- |
| `profile-edit/profile-edit.wxml` | 8,737 | `b18e73bacecee5fb7382e50a5db40b10ff43134ad15139faaeba11ca9f12c292` |
| `profile-edit/profile-edit.wxss` | 13,379 | `258427f5fb036ff3da89c8eea77f7eeee6b091c2c5318e1e12b06b7dc936b6ad` |
| `profile-edit/assets/wave68-back.svg` | 266 | `efeb362fc20c3e3a66fb6dc7be585f6ea7db8e9983609c44e148ef76807c3b24` |
| `badges/badges.wxml` | 6,169 | `aa4af4ecafddccd99eb9fbacdf990487eaf4746d0fd99649c86e85e6930720bc` |
| `badges/badges.wxss` | 22,281 | `f584d62c84dd8e816c469f58550c5b4f4fb588d1ed1bc6aab05f40523d9729c8` |
| `badges/assets/wave68-back.svg` | 266 | `efeb362fc20c3e3a66fb6dc7be585f6ea7db8e9983609c44e148ef76807c3b24` |
| `badges/assets/push-pin.svg` | 188 | `31d5e93e0b778cafd903bcf467d2de61c280360cf7f068c0fb460ad2cc17492b` |

实施者原始净增 7,989 B / 新 SVG 720 B 与其文件记录一致；这两个值仅表示源文件增量，不代表编译后的分包预算。

## 完整原稿身份

实际源目录是 `/private/tmp/irl-stitch-original/stitch_design_system_generator/pg10_a_edit_profile/` 和 `pg10_b_social_badges/`。两张完整 PNG 已打开观察，尺寸分别 589 × 1,600 和 622 × 1,600；原稿标题均为 **Edit Profile**，不能根据页码改成另一个设计。

本审查独立读取这四份缓存原字节并计算 SHA，均等于原来源记录。此前 ZIP 逐字节对应已有证据；本轮不重复解包 / ZIP 检查。

| 原稿 | B | SHA-256 |
| --- | ---: | --- |
| A `code.html` | 22,207 | `3a237335c3861eab11574f5a3b0272f3fc902c0c51c151edfc9bd57e80e0c5fb` |
| A `screen.png` | 215,687 | `3df4c4ed490eecbfd900df894f6d0687fb148662e757f52f82f2023477a1dbd7` |
| B `code.html` | 29,737 | `6bdd03d9c691ca3fedc1824c29eb38592ca60dc10384aca3437e0311f1ee4b0b` |
| B `screen.png` | 471,245 | `e8feb63c376df934bbb9247742ac849734b8cb77739a096a8b8c5b542b6a839c` |

## 有效 CSS 与原组件对照

独立审查以当前完整 CSS 级联为准：两页仍 import 受保护的 common，后置 owned 规则覆盖 common 的旧 rpx header 值；WXML 原 native 数据使用 px / `headerPaddingRight`，没有把原稿假 status bar 当成系统状态栏。源 `body` 15 / 21、Jakarta family 和原角色字重在当前页面层声明，按钮继承 family。

| 来源节点 | 原有效值 | 当前审查结果 |
| --- | --- | --- |
| A / B header | h56、左右16、gap8；back / more44；person32 / glyph18；back glyph24 / 600 | 后置规则 / 素材引用一致；back margin−4、more margin−4、person margin4、title px4、17 / 22 / 600 / tracking−.17 保留 |
| A / B header 材质 | surface85%、blur-xl24、shadow `0 1px 8px rgba(0,0,0,.03)` | 明确来源值一致；native sticky top / status cover 使用既有字段 |
| A 头像与光晕 | avatar96、p3；aura144、blur40、violet20% / blue15% / lime20% to-tr | 匿名头像保留，光晕准确；局部 stacking context 使负层可见，不引入源演示照片 |
| A 相机 / handle | camera glyph16、p8、shadow-lg；handle mt12、p4×12、copy14 + margin2 | 相机 disabled、handle 身份待开放保持；源尺寸和 shadow 两层有来源 |
| A 基础 / 兴趣 / 社交卡 | p12 / r12 / shadow-sm；基本 label13 /16、headline17 /22；兴趣 gap8 / p6×12 | 当前固定 px 与角色值相符；真实 R1 说明允许卡片自然增长 |
| A bio | `rows=3`、body15、`leading-relaxed=1.625`、p10 | 闭态框 min-height93.125 = 3×24.375 +20；有明确原 token 推导，未猜测未定义高度 |
| B summary | p16 / r16 / shadow-sm；176 两光晕、偏移−40、blur40；relative z10 | 当前准确；原演示等级 / 经验改为待开放文本 |
| B orb / XP | orb80、p4、inner r12 / white20% / blur-md12、verified36；XP white90% / blur-sm4 / p8 / track10 | 级联中 `.badge-orb .badge-orb-inner` 明确覆盖旧 generic view 字号 / line-height；12 / 4 对应正确 token，空进度不造 XP |
| B showcase / grid | showcase p12 / r16；4 槽 / gap12 / icon40；grid3 / gap12、卡p8 / r16；frame56 / circle48 | 当前列宽 `calc((100% - 24px) / 3)`；首4图形 mt4 / 其余 mt12、halo blur12、源渐变与 shadow 保留 |
| B 文本 / muted | 卡标题15 /20 /600 / truncate；副标11 /14 /700；未开放灰卡opacity.75 / shadow-none | 当前准确；闭态副文案自然换行不构造已达成事实；高 specificity 的 `.badge-cell.locked` 仍使后置通用 shadow 无效 |
| B 分享 | h56 / max448、三色 to-right、gap8、shadow-xl primary35% | 当前 source 容器 / 原生分享正确；原内容pb96再加闭态说明14+4，实际114+safe 预留有明确扩展来源 |
| B detail | max512、top r24、p16、handle40×4、icon80 / glyph44、shadow2xl；title20 /26 /700 | 当前准确；源第一概念 modal amber400→yellow300 to-tr，与卡片 to-br 渐变区分 |
| B detail 双槽 / 双动作 | 双列gap8、cell p8 / r12、caption11 /14 /700、value17 /22 /700；按钮py12 / label15 /20 /600 / gap8 | 当前布局恢复；文本真实待开放 / 未授予，关闭调用原方法，佩戴 disabled；真活动入口保留 |

原 B orb HTML实际是 `backdrop-blur-md`，并非上一份来源审计的“sm12”笔误。本批实施与报告按完整源 md12；XP / modal backdrop 分别 sm4。没有根据笔误把 orb 改为4。B muted glyph / source circle 的灰色及不带授予结果属于概念展示，不声明真实荣誉。

## 新素材、字体来源与可见角色

已读根代理 [共享字体证据](caper-profile-shared-fonts-wave68-2026-10-02.md)、[官方原字节 URL / hash](../design-sources/profile-reference-fonts/source.json) 和 [inspection 数组](../design-sources/profile-reference-fonts/inspection.json)。这部分审查核对引用、源 parent / axes 语义和导出记录，不重复安装依赖、下载字体、轮廓导出或根代理的全局 module 检查。

- 两页原 header 明确 `arrow_back_ios_new text-[24px] font-semibold`。原双 Material CSS 后置 face 使用 wght / FILL range；inspection[1] 是 Version2.972、FILL0 / wght600、固定 opsz24 / GRAD0、U+E2EA 原轮廓。父节点 `text-on-surface` 对应 `#1a1b1f`。独立逐字节比较两页新 back 与根提供的 266 B SVG，均相等；没有继续引用旧400作为600证明。
- B `push_pin text-[18px]` 无 FILL override，使用准确 Outlined / opsz24 / wght400 / FILL0 / GRAD0。实施记录保留固定官方 commit `bd8cb85bd4bad964fe6918f79665bb40c3a8efef` 的完整173 B SVG，SHA `8b95c9b784cd4901f1fe09d5c4076f42f5af3f9e7173fc49a93eb1bd82377bcd`。独立核实际188 B资产仅在 root 增加 `fill="#ffffff"`，每个 child / path 原字节不变；保留原 height / width24、无 viewBox，CSS18用于源 glyph 显示，不擅改路径。
- 页面 family 是真实 `Plus Jakarta Sans`。A 原 bio counter `font-medium`500 在当前闭态标签中仍500；根来源记录是官方 normal500 WOFF、weightClass500、Version2.071、29,728 B。A其余源角色400 /600 /700，B实际400 /600 /700 /800；B MAX-XP900演示未渲染，未以不存在的900字体宣称生效。
- 中文和表情仍回退系统字形；本审查不把 CJK 回退字形当作 Jakarta 内含 glyph，也不宣称本轮微信 `loadFontFace` callback、500或600实际图形渲染已验。

## 闭态与实际路由绑定

逐节点读 WXML 与当前完整 Page JS，未将源网页 onclick、fake toast 或演示统计直接当成真实小程序能力。`app.json` 中对应 canonical 页面、profile 分包、me tab 和原 event 兼容入口实际存在。以下是静态绑定核对，不是模拟器点击结果。

| 当前入口 | 实际绑定 / 路由 | 保护结果 |
| --- | --- | --- |
| A / B 返回 | `back` → `backToProfile`，`navigateBack({delta:1})` / fail回me | 既有 helper 保留 |
| A 更多 / 头像 | `toggleMore`、`goProfile`、`goPrivacy`、`goLegal` | 真实隐私与安全 / 法律页 / me；没有伪造主页 |
| A 活动内昵称 | `openAliasPicker` / `closeAliasPicker` / `goAliasActivity` | 保留 LOADING / UNAUTHENTICATED / EMPTY / ERROR / READY；GET `/me/events` 原 host / registration filter、请求序号与 identity 守卫、onHide失效守卫均原字节 |
| A 选定真实活动 | `goAliasActivity` | 仅允许当前 READY candidate ID，再核 identity；跳 `/pages/event/event?id=<encoded>&section=registrationSection&entry=alias`，不造固定活动 / 昵称 |
| A 浏览城市 | `goCity` → `/pages/city/city` | 原浏览城市选择范围；不修改全局身份资料 |
| A 注销申请说明 | `goPrivacyRequests` → me 的 privacySection focus | 原实际注销请求入口保持 |
| A 全局资料 / 保存 / 相机 / gender / interest / 认证 | 闭态 view 或 disabled 控件 | 无新增写入绑定、虚假云同步、演示头像 / handle / 已认证结果 |
| B 分类 / 概念卡 | `selectCategory` / `openBadge` / `closeBadge` | 仅 known category / plannedBadge ID；原9概念投影、onHide清空及概念说明保持 |
| B detail 双动作 | `closeBadge`；wear明确disabled | 无授予 / 佩戴 mutation；backdrop与sheet为兄弟，不会点击sheet冒泡到backdrop关闭 |
| B 真活动入口 | `goActivities` → `/subpackages/profile/moments/moments?filter=all` | 页面 / modal 两处保留，先清当前modal / menu |
| B 分享 | `open-type="share"` / `onShareAppMessage` | 真实 badges canonical path；title标“概念预览（勋章尚未开放）”，不伪造朋友圈海报 / 认证 / 成就 |

## 受保护原字节与收尾

独立读取当前 A / B JS / JSON 后计算 SHA，四份均等于实施前记录。未重复运行其 binding 计数 / WXML 逆向还原检查；那些结果由实施者101项证据保留。

| 保护文件（profile 分包） | B | SHA-256 |
| --- | ---: | --- |
| `profile-edit/profile-edit.js` | 5,210 | `2fe8db9e0ca20e5be74c78a3289da0a99c92a962483fa41e72b97c08d8b8be70` |
| `profile-edit/profile-edit.json` | 69 | `2be9acff05f45514df7b25f6468ef08060496ddd4944ffde92ca1e52360eedc0` |
| `badges/badges.js` | 4,094 | `0d3f2b9bd5b83f5dd05db67538da58a6bc219192a4681491ace56d1d6e375452` |
| `badges/badges.json` | 69 | `87e891486bff9a8628468a9e96bfa072f93cde60df20d41b4f8c839e41f4b8b3` |

无新增整改项，产品 freeze 保持。后续根代理应以本批定向截图 / 点击 / native 字体证据和实际编译包值形成运行结论；本独立审查不扩大到其他 profile 页、PG04-S 或全部39屏。

## 最终 500 alias 定点复核

根代理在提交 Wave68 前明确授权将准确官方500 face独立注册为 `Caper Jakarta Profile 500`，以免给全局 `Plus Jakarta Sans` 增加500后改变原四face页面的匹配。A唯一owner只在最终 `.bio-heading text` 的原500声明中追加 `font-family: "Caper Jakarta Profile 500", "Plus Jakarta Sans", sans-serif;`。B及另6条产品路径的冻结记录未变。

本审查只针对这一新增声明读取最终A CSS与新版manifest，不重跑原101项、来源全审、SDK或其他测试。实际新增字节序列只有75 B且出现一次；逆除该序列后13,379 B，SHA恢复为初次已审 `258427f5fb036ff3da89c8eea77f7eeee6b091c2c5318e1e12b06b7dc936b6ad`。因此此前布局 / glyph / 真实binding结论继续适用。只读当前 `reference-font-data.js` 的对应记录也确实是独立 family、weight="500"；此处没有重新审查全局导出或声称native font callback完成。

- **最终 A WXSS：13,454 B / `043c7f2a12f050cec6bf4505ea51f526b5388d2dc5865bc6e4d40b78c0b675a7`。**
- **最终9路径freeze清单：1,687 B / `986c71b4fa81e3887a527077ec4fb6d174b50a7f8b2404ab85dbb8943f025b62`。** 清单包含A新CSS和另6条原产品hash；实施MD / JSON分别更新为12,117 B / `26618d6c923bfd5c34a0d70b49f653fe48b369b4a306bfb98897672e014c3f0a`、20,510 B / `27e5810c579d78d7cc00aa79dcefc46fb80c9147ed89134b18f5e846e8ea172d`。
- 产品原始净增随这一作用域声明增加75 B，最终8,064 B；原新SVG总720 B不变。实际编译包值仍由根代理测量。

限定角色的CSS weight仍500，准确family名与注册名一致；原缺字回退继续存在。此定点订正无新增来源或路由问题，最终产品freeze保持。
