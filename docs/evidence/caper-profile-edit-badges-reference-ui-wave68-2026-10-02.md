# Wave 68 — PG10-A 个人编辑 / PG10-B 概念勋章原稿恢复

日期：2026-10-02。按照 [Wave68 计划](../superpowers/plans/2026-10-02-profile-four-and-published-reference-ui.md) 及 [四页只读来源审计](caper-next-profile-reference-gap-audit-wave67-2026-10-02.md) 实施。本代理唯一可写域是 A / B 的 WXML、WXSS、必要准确 SVG 和本证据；未修改 JS、JSON、common、navigation、全局字体 / 配置、矩阵，不执行 SDK / CLI / Git mutation 或全量测试。

结构化来源、原 / 新文件 hash、唯一局部检查记录见 [本批 JSON](caper-profile-edit-badges-reference-ui-wave68-2026-10-02.json)。此次产品原始净增 **8,064 B**，其中准确新 SVG **720 B**；这不是实际编译包增加值或包预算验收结果。

## 原稿身份与复用

使用用户完整 `pg10_a_edit_profile`、`pg10_b_social_badges` 的 HTML / PNG。原 ZIP SHA-256 为 `df22e733d33fda20979b75b8a7bc94717c4a5c9e41561a54e3038432fab32603`；原 39 个页面映射保持。此前四页审计已逐字节核对两页 HTML / PNG 与 ZIP，本次完整源阅读及 PNG 对照用于准确 CSS / 组件恢复。

原两页标题都是 **Edit Profile**，已保持。匿名头像、真实活动内昵称、浏览城市、概念勋章、真实活动入口及待开放状态继续复用。原演示人物、Léo handle、等级、MAX-XP、经验进度、授予日期 / 结果、已佩戴、28 枚等不作为真实数据复制。

## A — 个人编辑

- 现有所有 owned WXSS 的 rpx 使用原 375 px 比例作等值固定 px 转换；然后按完整原稿逐项恢复视觉来源。该转换包含既有真实昵称扩展组件的样式，未改变其 binding / 状态 / 方法。
- 页面自身继承 Plus Jakarta Sans、body 15 / 21；按钮 family 显式继承。保留 CJK 和旧客户端 fallback，不改全局 loader。
- header 56 px、左右原 margin、返回 / more 点击 44 px、头像 32 px、gap8；源 title 17 / 22 / 600、−.17 px tracking、padding4；more margin−4 / avatar margin4。原 native `headerPaddingRight` / statusBarHeight / sticky top 与原菜单位置保留，新增原 24 px backdrop blur。
- 头像后恢复原144 ×144 px、to-tr violet20% → blue15% → lime20%、blur40、z−10、非交互光晕。父层建立自身堆叠上下文，避免小程序页面底色覆盖负层；匿名头像未换原演示照片。
- 原 shadow-md 两层用于头像和保存闭态壳；原 camera shadow-lg 两层用于禁用相机入口。闭态文案 / 灰色身份与按钮禁用保持。
- handle 的 source copy glyph 额外 margin2、source headline / label tracking、认证文本源 truncate、删除 underline-offset4 / padding-bottom8、外层原pb12=48与native safe-area均恢复。
- 源 bio textarea rows3 ×（15 px ×1.625）+ padding20 = **93.125 px**，作为闭态内容框的最小高度；这是显式 rows / body / leading-relaxed / p2.5 推导，未为未定义高度 token 造值。
- 原 bio-counter `font-medium`500 对应的闭态 `.bio-heading text`保留500；由根代理接准确500 WOFF并以 **Caper Jakarta Profile 500** alias限定该最终selector；其余body仍Plus Jakarta Sans原faces，避免全局新增500改变其他页面匹配。A其它主源节点400 /600 /700。

真实昵称选择器的 `GET /me/events`、host / enrollment 过滤、五种加载状态、session / requestId / onHide 守卫、真实 candidate ID 与 canonical event URL、浏览城市和注销请求路由均原字节保留。

## B — 概念勋章

- owned WXSS 的固定 px、body15 /21、header源56 /44 /32、gap8、24 px blur / rgba / source shadow及源文字 tracking恢复；native inset / sticky与more菜单仍使用原数据。菜单锚点使用完整源56 px header底边。
- summary恢复原176px两环境光晕（primary10% top/right−40；lime20% bottom/left−40；blur40）、overflow-hidden和relative z10内容层、shadow-sm。
- summary orb恢复source shadow-lg / primary20%，内层原 **backdrop-blur-md=12 px**，36pxverified原drop-shadow，源label800 / tracking / mt−2。XP卡是 **backdrop-blur-sm=4 px**、white90%、shadow-sm，XP track仍为空。
- 纠正上一份只读审计的文字笔误：那里把 orb 写成“blur-sm12”；完整源 HTML实际是 `backdrop-blur-md`12。本产品恢复按实际HTML；XP卡和modal backdrop才是sm4。
- 勋章 halo 恢复原blur-md12；卡shadow-sm / 图形shadow-md两层；未授予的两张muted卡保持灰色、opacity.75 / 无shadow。原19条图标素材记录与其真实asset hash保留，9个概念和筛选投影不改。
- 标题原单行truncate、15 /20 /600恢复；实际闭态副文案允许自然增长，彩色卡采用源variant `#424655`，muted采用outline `#737687`。这不向用户授予图形中的荣誉。
- showcase closed-pill从遗留500改为原label-sm700；B实际source weights400 /600 /700 /800。原MAX-XP900不渲染，因此不新增900字库。
- fixed原生分享容器 **max448 px**、原h56、三色to-right、gap8、source shadow-xl / primary35%、安全区恢复。保留概念说明和`open-type="share"`；source主内容pb24=96 +闭态说明14行高 /4间距=114px底部预留，避免真实入口被fixed bar遮挡。未复制原“朋友圈海报已生成”toast。
- detail恢复 **max512 px**、top radius24、p16 /native safe、source shadow2xl、40×4handle、80px原图形框、20 /26 /700 title、13 /16 category和15 /21 notice。第一羽球concept的icon外壳采用原modal amber400→yellow300 to-tr；其它概念继续对应真实 selectedBadge 图形和既有来源配色。
- 原双统计槽结构使用真实闭态「获得经验 / 待开放」「授予状态 / 未授予」，替换源+200XP /Top3.2%，不创造授予结果。原底部双按钮恢复：**关闭接原closeBadge；佩戴明确disabled**，原push_pin18px准确官方SVG只作图标。已有真活动`goActivities`入口继续保留，不引入任何写入方法。
- backdrop使用原inverse-surface40% /blur4；sheet与backdrop保持两个独立兄弟节点，点击sheet内容不会冒泡到backdrop关闭。原关闭方法 / onHide / category id guards / selectedBadge / share path 全部原字节不变。

## 准确新素材

### 两页返回

由根代理独占官方字体证明提供 `/private/tmp/caper-wave68-shared-fonts/profile-back-wght600.svg`。源后置 Material face 的可变 axes为FILL /wght，600 /FILL0实例，opsz24 /GRAD0固定，glyph `arrow_back_ios_new` U+E2EA原outline无舍入；实际源 parent为on-surface，fill **#1a1b1f**。

原资源266B，SHA-256 `efeb362fc20c3e3a66fb6dc7be585f6ea7db8e9983609c44e148ef76807c3b24`。A /B各精确复制为自身 `assets/wave68-back.svg`并仅替换header引用；旧400素材 /manifest保留追溯。本代理只核精确复制 /root fill，官方WOFF2 /CSS /TTF /axes /path完整证明见根代理 [shared-font汇总](caper-profile-shared-fonts-wave68-2026-10-02.md)、[source manifest](../design-sources/profile-reference-fonts/source.json) 和 [inspection.json 数组 index 1](../design-sources/profile-reference-fonts/inspection.json)；未独立宣称微信实际glyph渲染通过。

### 佩戴 push_pin

源：[固定官方 Google SVG](https://raw.githubusercontent.com/google/material-design-icons/bd8cb85bd4bad964fe6918f79665bb40c3a8efef/symbols/web/push_pin/materialsymbolsoutlined/push_pin_24px.svg)。Google `material-design-icons`固定commit `bd8cb85bd4bad964fe6918f79665bb40c3a8efef`、Outlined /24 /wght400 /FILL0 /GRAD0，[Apache-2.0](https://github.com/google/material-design-icons/blob/bd8cb85bd4bad964fe6918f79665bb40c3a8efef/LICENSE)。Web读取因SVG MIME不支持返回400；随后直接获取该同一准确官方文件173B，未以失败网页或其它图形替代。

原SHA-256 `8b95c9b784cd4901f1fe09d5c4076f42f5af3f9e7173fc49a93eb1bd82377bcd`；仅新增 root `fill="#ffffff"`（原源按钮on-primary），child /path整字节不变。产品188B，SHA-256 `31d5e93e0b778cafd903bcf467d2de61c280360cf7f068c0fb460ad2cc17492b`，`badges/assets/push-pin.svg`。原SVG全文和准确URL /hash保存在本批JSON，不向app主包加证据manifest。

## 有界检查与边界

唯一必要静态来源 /resource /binding /保护检查：**101项通过、0失败**，执行exit0。它检查两页 JS /JSON整字节、WXML标签结构、原binding名称及次数、每个binding存在于原Page方法、条件 /list /dataset表达式不变、ownedCSS无rpx和brace配对、实际所有静态及原JS动态图标列表资源可解析、38条旧素材hash、600精确副本、pin child原字节、禁用控件数与WXML逆向还原。

A逆向仅去新增光晕和新back路径即可还原旧WXML字节；B逆向仅去新增source层 /share wrapper、替回原modal段 /back路径即可还原旧字节。因此真实数据绑定和source外业务入口未改写。modal改变的是原组件和诚实闭态展示；JS无新增读写。

保留一次检查器错误：第一遍静态method正则未识别原`async openAliasPicker`，报A binding不存在。产品方法本来存在；只补正则的`async`识别后取得上述101项结果，未为修检查器改产品。本批JSON保留起始错误 /原因 /纠正；未以任何假业务PASS填补。

没有运行原101项之外的业务VM、既有测试、全量、CI、SDK、微信CLI；没有真机 /正式资源验收。实际字体（包括500）、新600 glyph、跨viewport、native capsule、safe-area、source投影与所有改变的实际点击链由根代理后续Developer Tools做本批局部复核；编译包预算须根代理实际CLI测量。

## 产品freeze清单

| 相对仓库路径 | 字节 | SHA-256 |
| --- | ---: | --- |
| `miniprogram/subpackages/profile/profile-edit/profile-edit.wxml` | 8,737 | `b18e73bacecee5fb7382e50a5db40b10ff43134ad15139faaeba11ca9f12c292` |
| `miniprogram/subpackages/profile/profile-edit/profile-edit.wxss` | 13,454 | `043c7f2a12f050cec6bf4505ea51f526b5388d2dc5865bc6e4d40b78c0b675a7` |
| `miniprogram/subpackages/profile/profile-edit/assets/wave68-back.svg` | 266 | `efeb362fc20c3e3a66fb6dc7be585f6ea7db8e9983609c44e148ef76807c3b24` |
| `miniprogram/subpackages/profile/badges/badges.wxml` | 6,169 | `aa4af4ecafddccd99eb9fbacdf990487eaf4746d0fd99649c86e85e6930720bc` |
| `miniprogram/subpackages/profile/badges/badges.wxss` | 22,281 | `f584d62c84dd8e816c469f58550c5b4f4fb588d1ed1bc6aab05f40523d9729c8` |
| `miniprogram/subpackages/profile/badges/assets/wave68-back.svg` | 266 | `efeb362fc20c3e3a66fb6dc7be585f6ea7db8e9983609c44e148ef76807c3b24` |
| `miniprogram/subpackages/profile/badges/assets/push-pin.svg` | 188 | `31d5e93e0b778cafd903bcf467d2de61c280360cf7f068c0fb460ad2cc17492b` |

原业务文件保留：A JS5,210B SHA `2fe8db9e0ca20e5be74c78a3289da0a99c92a962483fa41e72b97c08d8b8be70`、A JSON69B SHA `2be9acff05f45514df7b25f6468ef08060496ddd4944ffde92ca1e52360eedc0`；B JS4,094B SHA `0d3f2b9bd5b83f5dd05db67538da58a6bc219192a4681491ace56d1d6e375452`、B JSON69B SHA `87e891486bff9a8628468a9e96bfa072f93cde60df20d41b4f8c839e41f4b8b3`。

## root 协调后唯一字体 alias 调整

根代理识别全局新增Jakarta500可能改变N1原source字体匹配，因此将唯一新500face命名为 `Caper Jakarta Profile 500`。A完整原稿只有line77的 `#bio-counter` 一个 `font-medium` 候选，与 `text-label-sm` token700同节点；当前诚实闭态映射仅 `.bio-heading text`。产品只在该selector最后一条500声明中新增 `font-family: "Caper Jakarta Profile 500", "Plus Jakarta Sans", sans-serif;`，旧较早500声明和所有其他产品字节保持。

CSS新增 **75 B**，从 `258427f5fb036ff3da89c8eea77f7eeee6b091c2c5318e1e12b06b7dc936b6ad` /13,379B变为 `043c7f2a12f050cec6bf4505ea51f526b5388d2dc5865bc6e4d40b78c0b675a7` /13,454B。唯一必要定点核对：逆除这一新增declaration后与原freeze整字节相同；没有重新跑101项检查或已由root完成的SDK路线。共享fontrecord /loader /别页source500由root统一协调；准确原字节字库仍由root验证，此文档不据class书写顺序独立宣称浏览器生成CSS级联或native字形通过。
