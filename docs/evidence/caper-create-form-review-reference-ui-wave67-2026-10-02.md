# Wave 67：新建 FORM 与发布草稿 REVIEW 原稿接入

日期：2026-10-02。范围由 `docs/superpowers/plans/2026-10-02-tab-form-registration-reference-ui.md` 授权。这里只记录 create 页面独占改动、来源和有限检查；微信编译、原生点击、包体、字体实际显示和 GitHub 发布由根代理另验。

## 来源及适用分支

读取用户压缩包解出的完整 HTML 与 PNG；页面名称按真实源码判定：`caper_ai` 是表单，`pg04` 是发布草稿确认；不把 `pg04_s` 当这两页。

| 原文件 | 字节 | SHA-256 |
| --- | ---: | --- |
| caper_ai/code.html | 43,225 | baa9cbbb84c513529e4df1f7efdaec4057a9585993242983565fd58d5b461628 |
| caper_ai/screen.png | 200,437 | 233c1db76acebe257d35350c33b5c8bae5ebf435a02f09b90b945072d2153dd5 |
| pg04/code.html | 15,626 | d61b1b9d6d221cf03ef4ab9d1c8218ea004e2594ce3638f95a35dfbf7f43f2a7 |
| pg04/screen.png | 265,612 | 9df8eb1764604bd81f7ecc6f5d2125a9f0ff4ec07e2056b9ad45dd3a40b65bb3 |

原路径在 `/private/tmp/irl-stitch-original/stitch_design_system_generator/`。此前 ZIP 相等证明见 Wave 66 原稿缺口审计。SVG 逐节点来源另存 [`caper-create-form-review-inline-sources-wave67-2026-10-02.json`](caper-create-form-review-inline-sources-wave67-2026-10-02.json)。不复制原稿虚构的日期、场地预订、费用预估、付款、状态栏、手机外框或 Home Indicator。

- FORM：只有 `stage === 'FORM' && !editingEvent` 加入 `.form-reference` 和新表单。
- REVIEW：只有 `stage === 'REVIEW' && publishPreview && !changePreview` 加入 `.review-reference` 和新确认页。
- 旧完整 FORM 留在 `stage === 'FORM' && editingEvent`；旧完整 REVIEW 留在 `stage === 'REVIEW' && (!publishPreview || changePreview)`。
- 旧 header 原内层、IDEA 占位/notice/完整 IDEA 原字节保留。编辑已发布活动、变更差异、严重变更确认继续使用旧分支。

## 原稿对应的细分 selector

以下来源值从有效 CSS、Tailwind 有效 token 和 inline SVG 获取。R1 必要字段与关闭态是原真实功能的保留，不声称原 PNG 中有对应产品信息。

| 区域 | 产品 selector | 来源值与真实映射 |
| --- | --- | --- |
| FORM 外容器 | `.form-reference` | caper_ai 69：宽100%、最大420px、居中、slate50；底部原 `pb-36` 为144px，补真实 safe area |
| FORM header | `.reference-form-header` / `-nav` / `-brand` / `-drafts` / `-profile` | sticky、白90%、blur12、nav32px+上下10px；logo32/r12、glyph14/16；按钮按现有 native capsule inset 排列。品牌最大宽是 `100% - --form-draft-right - 86px`，86为原草稿钮78+8间距，受限文本裁剪；不使用任意208px常量 |
| FORM 标题、手写贴纸 | `.form-intro-*` / `.form-annotation` | 24px/30px/900、12px/19.5px；原有效 Chalkboard SE/Comic Sans MS/cursive 栈、10px/15px/800、旋转+6°。不把原手写节点改用 Caveat |
| FORM AI 图形 | `.form-orb-*` | 原64px/r16、indigo/slate/black渐变、30%原径向光晕、10px双眼+8px间距、cyan/lime、原名称badge和6pxdot；纯 CSS，不添加外部图或绘制新形状 |
| 描述/灵感 | `.form-prompt-*` / `.extract-button` / `.form-inspiration*` | p14/r16、textarea14px/22.75px/3行，32px动作；原p8×12/r12/gap8、emoji20、主12/副10。输入/本地提取/轮换仍调用原方法，不显示模型成功 |
| 分类 | `.category-section` / `.activity-*` / `.selected-check` | 原6列、gap8、正方形/r12、emoji24、label11、选中border2/check16；真实可用羽毛球与原关闭态保留 |
| 时间 | `.quick-*` / `.form-quick-date` / `.form-poll-*` | 4列、p8/r12，日期副文案10/15；时段11/16.5。日期显示由同一真实北京时间规则投影，原日期/时间picker与结束日期字段保留；投票暂未开放 |
| 地点/人数/费用 | `.field-*` / `.form-environment` / `.form-districts` / `.participant-*` / `.fee-*` | 原16px卡片padding/r16、heading14，环境4列/区域7项、人数4列、费用4列/p10/r12。地点环境/区域/人群筛选关闭态，不虚构已选择；城市、场地核实、4–6/5–10/10–12、host占席、AA上限/取消/截止仍是实际字段 |
| 海报 | `.form-poster-*` | 原3:4比例、三个准确渐变、emoji和原大写文字、小check；恢复源 CSS 示例，生成/上传仍关闭，不改实际payload或图片文件 |
| 可见性/主理人/工具箱/预览 | `.visibility-*` / `.cohost-*` / `.form-host-badge` / `.toolbox-*` / `.form-preview-*` | 原4列/r12，host36px真实“我”、HOST lime badge；toolbox原dark渐变/128px glow/blur40/✨60px；预览80px海报。实际可见性/审批picker保留，协办人走原真实入口；文案保留R1限制 |
| FORM actions | `.form-reference .form-actions` | caper_ai 693：固定、宽100%/max420/居中、p10×16、gap12、1:2按钮、14/16图形；底部为64px+safe，与真实FORM Tab协调 |
| REVIEW 容器/header | `.review-reference` / `.reference-review-*` | pg04 57：宽100%/max400；未复制手机固定852px高度/6px边框/缺省状态栏。nav原52px，back36px/-4px/glyph24，title17/700，more原三圆24；native safe inset保留 |
| REVIEW banner/orb | `.review-banner` / `.mini-orb` / `.review-orb-*` / `.banner-*` | 原p14/r16/#E4DEFF边框/三色淡紫渐变；orb44、eyes6、mouth10×4/shine6、准确shadow/blur；标题14/21、副12/16.5，原16pxgray400chevron |
| REVIEW rows | `.review-row` / `.review-label` / `.review-value` | 原py12、bordergray100、label gap12/glyph16/stroke1.8、普通值14px/21px；原14px gray300 chevron逐个使用 |
| REVIEW 细分字号 | `.review-value-compact` / `.review-value.multi` / `.review-fee-value` / `.review-visibility-value` | 具体场地207、报名截止275：13px但继承21px行高。时间两行13px/17.875px，次行gray500；费用与可见性次行原text-xs=12px/16px/gray400，限定对应类，未误施加到时间 |
| REVIEW 真实状态/费用 | `.review-pill.*` / `.review-extra` | 原pill12/16/p2×8/rfull/green/blue；场地值依据真实HOST_CONFIRMED，host-pill只在真实参加时显示。无“已预订”或“需到场付”假事实。AA显示实际capFen，FREE无费用；R1版本/审批/取消/成局截止继续保留 |
| REVIEW actions | `.review-reference .review-actions` | 原footer受max400容器约束，真实长页改fixed/居中/max400，p12×20/pb32+safe/gap14；36/64比例（可缩，防止gap溢出），15px/22.5px/600、原按钮颜色/shadow。仅调用原save/confirm及安全禁用 |

新增 CSS 是旧29,928字节的完整后缀；没有公共 header/业务 CSS 覆盖。源码未定义的 `rounded-2xs`、`shadow-2xs`、`shadow-xs`、`active:scale-98`、`w-13/h-13`、`py-0.2` 不猜值。状态栏/native capsule和safe area采用运行环境真实信息；系统字体/emoji跨平台字形仍需原生观察。

## 图形来源和增量

新增23个准确 inline SVG：FORM 9个、REVIEW 14个，共6,000字节；未新增照片、字体、库或线上依赖。SVG只有根节点class移除、currentColor按实际源节点解析、xmlns/实际宽高补齐与viewbox大小写规范；所有 source child 包括path/circle/line/rect、stroke/fill与空白保持逐字节一致。详尽路径、source line、源child hash及文件hash在来源 JSON 中。

FORM calendar/pin 原色为 slate400 `#94A3B8`，先前跨页复用建议的 gray400 `#9CA3AF` 不等价；因此生成两个准确小SVG。REVIEW back、banner-chevron、row-chevron 原稿没有viewBox：保留未定义状态与原实际24/16/14视口，未补虚构 `0 0 24 24`；child坐标按原实际 viewport保留。白色arrow在FORM14px与底部16px场景复用同一准确child。

## JS 仅显示投影

新增4处：`referenceQuickDates`/`referenceReviewLabels`纯函数块、data的日期投影、onShow的日期投影刷新、新建草稿reviewSummary spread投影。原summary start/end/registration/confirmation/fee等字段仍保留，所有业务方法、字段payload、身份/版本/安全检查、API/路由未改。

日期与费用以实际payload投影，不写入payload：同日时间显示HH:mm–HH:mm，跨日保留结束日期；非法/缺失时显示待确认；AA使用实际分转元两位，未知cap显示上限待确认。移除上述4处新增即可恢复原 JS 完整字节，SHA-256：`ed71d3750551182c6676c8c71e204f1396343d5f5eb46a84f6fde1ff0847d4ef`。

## 限定检查与 review 修正

一次来源/保护检查 `/private/tmp/caper-wave67-create/source-protection-check.json`：**59项 PASS**。原FORM的64个mutation binding全部保留，新FORM73个；增加的是明确关闭态控制，未遗漏字段/disabled/id/data/bind/catch属性。原publishPreview和返回的15个mutation binding全部保留，新页15个。原完整editing FORM、REVIEW/changePreview、header/IDEA及旧CSS字节保护通过。23个SVG child与runtime path检查通过。新增样式211个selector条目均限定新分支（该计数为review补丁前）；没有旧分支通用覆盖。

WXML有限XML检查初次碰到现有合法微信bare `wx:else`，该语法不是XML合法裸属性；只在检查器将其规范为 `wx:else=""` 后通过，没有为迎合检查器修改产品WXML，也没有把该结果充当微信编译成功。

一次必要VM `/private/tmp/caper-wave67-create/projection-check.json`：**15项 PASS，API写入0**。9项用保留的真实chooseQuickDate方法与新增显示投影比较周五、周日、跨年北京时间；6项检查真实同日起止/AA分数、payload不变、跨午夜结束日期、非法日期/未知费cap、非法结束时间和FREE忽略无关cap。JS被检查时SHA为 `756912f00f8fbf590461d644041b9dac151e1783e630c68f335ad9cbc3bdb3e5`，之后未改。

独立审查提示限宽与两行字号后，重新核原HTML，仅补8处CSS和4处WXML显示修正：FORM max420、REVIEW max400及各fixed actions限宽；native品牌受限文本裁剪；具体场地/报名截止13px/21px；费用和可见性真实两层文案细分12px/16px/gray400。`limited-review-corrections-check.json` 证明逆除12处补丁即可逐字节恢复59项检查的产品快照，不重复原已通过检查。源SVG、JS与业务属性均未改。

## 验收边界与预算

这是原稿节点接入及保护证据，不是所有尺寸/系统字形在微信中的一比一渲染验收。未运行全量/CI/微信CLI/SDK，也未操作Git。原生点击、真实请求/发布、Tab避让、窄屏/nativecapsule、长页fixed actions与编译包体仍由根代理定向验。

最终原始产品字节：JS41,649（+1,810），WXML59,070（+29,984），WXSS59,578（+29,650），23个SVG6,000（+6,000），**原始净增67,444字节**。来源JSON与本证据只在docs，不进入应用素材。源码差额不能推算实际CLI压缩包；Wave66余3,063字节，新批需要根代理计划中的实际包体策略与最终CLI测量。
