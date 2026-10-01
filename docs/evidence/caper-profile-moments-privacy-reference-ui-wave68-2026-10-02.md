# Wave 68 PG10-C / PG10-D 原稿恢复实施证据

日期：2026-10-02。独占实施者：`/root/ui64_review`。基线：`a72ba3e`。范围：`subpackages/profile/moments` 与 `subpackages/profile/privacy-safety` 的 WXML、WXSS 和 3 个来源准确 SVG。

## 输入与读取范围

已完整阅读实施计划 `docs/superpowers/plans/2026-10-02-profile-four-and-published-reference-ui.md`、只读差异审计 `docs/evidence/caper-next-profile-reference-gap-audit-wave67-2026-10-02.md`、两份完整 HTML、两个完整 PNG 及两页当前 WXML/WXSS/JS/JSON、共同样式。原稿来自用户 ZIP `/Users/tsb/Downloads/stitch_design_system_generator (2).zip`，SHA256 `df22e733d33fda20979b75b8a7bc94717c4a5c9e41561a54e3038432fab32603`。下列 4 个缓存原文件均与该 ZIP 内文件逐字节相等；PNG 分辨率为导出比例，不作为 CSS 尺寸。

| 原文件 | Bytes | SHA256 |
|---|---:|---|
| `pg10_c/code.html` | 29,565 | `cdf5a961530cf79b5678b45cef5dfb2347e6f5c0de442b871f5c6aba5bb49d5e` |
| `pg10_c/screen.png` | 686,754 | `836659cfbca0fac930e6bdef69955d9485aa752f361098e3a667c1444ad4352b` |
| `pg10_d/code.html` | 16,674 | `0c947827be5b24cf753dc84a06c3cd8fa9af3937be05cd4f9a7ac2cc981d4af2` |
| `pg10_d/screen.png` | 276,091 | `01158ae45ca5979f5680ad7cf7a9d422347df151e02669477596c24f0ec07dc8` |

完整来源与逆还原记录：`docs/evidence/caper-profile-moments-privacy-sources-wave68-2026-10-02.json`（12,536 B，SHA256 `309514e2f4bef004202dea77af5277257ff05da1e87a7c6460942067e965bb7d`）。旧文件快照保存在 `/private/tmp/caper-wave68-profile-cd/baseline/`，未覆盖其他实施者文件。

## PG10-C：我的活动 / Moments

- 页内新增样式均限定 `.moments-page`，使用原 CSS 实际 px 和 Jakarta 字族；旧页内 rpx 按 375 基准换为 px，未改 common/global。恢复 56 px 原 header、原胶囊适配框架、44 px 返回/更多、24 px 原返回字形、32 px person 圆、17/22 px 标题及 13/16 px 真实筛选。
- 恢复摘要原渐变、96 px lime 光晕、40 px 图标、17/22 px 标题、11/14 px badge、13/18 px 正文、真实筛选和状态。卡片恢复原 12 px 内边距/圆角、16 px 卡间距、17/22 px 标题；日期/4 px 圆点/真实场地恢复原结构，场地为原 500 字重蓝色。
- 恢复原 grid：羽毛球 12 列、large 跨 8 列且 4:5、stack 跨 4 列且两个方图；野餐 3 列、large 一列 3:4、stack 两列且内两列 3:4；桌游两列且 4:3。全部为现有 JPEG 原字节与 `aspectFill`，未生成替代照片。
- 恢复原 badge/caption 的位置、背景、blur、旋转、字号与图标，内容继续说明示意/相册未开放。原页图形有假的胜者、照片数量、点赞数量、评论、在线点；未制造这些业务数据，也未新增假按钮。真实 `statusLabel` 保留为额外 11/14 px 第三行，这是原稿视觉与真实业务之间的明确适配。
- 闭态 AI 卡恢复原 purple/white/blue 渐变、40 px icon、17/22 px 标题、13/18 px 文案、闭态标记；恢复底部渐变外框、最大 448 px 居中、52 px blue CTA 与 11/14 px lime badge，底部使用实际 native safe inset。原草稿/活动数据、筛选、IDs、导航和提示原样保留。

## PG10-D：Privacy & Safety

- 页内新增样式均限定 `.privacy-page`。恢复原英文标题 `Privacy & Safety`，通过 WXML `<text decode="true">Privacy &amp; Safety</text>` 展示。56 px header、44 px 原触区、24 px 返回、32 px person 圆及 native 状态/胶囊适配保留。
- 恢复原卡片影子、16 px hero 内边距、144 px blue 5% 光晕/blur 40 px、40 px icon、17/22 px 标题、11/14 px 副文案、13 px / 21.125 px relaxed 正文。
- 按完整 HTML 的父级 flex gap 恢复 hero 到名单标题 16 px、记录间 8 px、末条到帮助卡 28 px（父 gap 16 加帮助卡 margin-top 12）。名单为真实 `blocks.length` 与 `blocks`，原 48 px avatar、16 px badge、12 px card padding、38 px 最小操作高度保持准确。
- 真实空态、撤销中的 disabled 状态、真实 `data-id`、身份隔离、block/revoke/request/error 与举报入口保持。未复制原稿虚构用户、拉黑原因、日期、滑动删除或越过 R1 的公共广播/私信承诺。
- 帮助图标恢复源 party-pink `#ff2d55`；帮助文案仍如实反映当前可用功能，现有说明未删。正文 bottom 40 px 加实际 safe inset，未复制原 status mock。

## 字体和准确 glyph 边界

Root 负责把准确 Jakarta normal 500 注册为专用 alias `Caper Jakarta Profile 500`，只供明确需要 500 的个人页节点使用；其它页面的原 400/600/700/800 面匹配保持。本任务未改字体模块、loader、app、公共样式或配置。两原稿返回节点均为 `text-[24px] font-semibold`，后置 Material 变量 face 有 `wght` 100..700 与 `FILL` 0..1，正确实例为 wght 600 / FILL 0，opsz 24 与 GRAD 0 固定，U+E2EA。两个新返回 SVG 均与 root 冻结来源 `/private/tmp/caper-wave68-shared-fonts/profile-back-wght600.svg` 逐字节相等：266 B，SHA256 `efeb362fc20c3e3a66fb6dc7be585f6ea7db8e9983609c44e148ef76807c3b24`，fill `#1a1b1f`，未舍入 path。旧 400 SVG 和来源 manifest 保留。新帮助 SVG 仅将原已准确 report 几何的根 fill 改为原稿 `#ff2d55`；原 path、viewport 及旧 report 资源均保留。

本实施仅核新返回 SVG 与 root 来源复制相等；root 官方 variable face 的独立实例审查将记录于另一份独占字体证据，不能把复制相等解释为独立 font PASS。

## 一次必要保护检查

执行 `/private/tmp/caper-wave68-profile-cd/check_source.py` 一次，exit 0。记录 `/private/tmp/caper-wave68-profile-cd/limited-source-check.json`，SHA256 `6c4ec281c1d6e4f86332c60ac16fc3112b065d54912109443bf01e3a71878e89`。

- 两页 JS 与 JSON 均逐字节等于基线；Moments 15 项、Privacy 10 项实际绑定 multiset 全等。真实模板表达式全等，唯一允许值差异是记录间距 16 rpx 到源 8 px。
- 两页完整 WXML 经明确视觉操作逆还原后与旧完整 WXML 逐字节相等。归一化 wx/moustache 后 XML 可解析；此检查不是微信编译器结果。
- 11 / 10 处静态图片和 27 处 JS 图片 literal 引用均解析到真实文件；全部旧 SVG、旧来源 JSON、8 张 JPEG（544,960 B）均原字节。
- 数字 rpx 已从两页 CSS 清除，新 600 返回复制相等，帮助 SVG 仅 fill 改色。

4 个业务文件保护：moments.js 8,564 B SHA256 `8b067cadb3bd9b127fd700712f138fe4ab26d4e832dc469e1817663bf4deacdb`；moments.json SHA256 `e52785ddb393f087f62846072ae5780bba40241f2c11adfbf6b9bd5d481eea6f`；privacy-safety.js 4,209 B SHA256 `f2da6b103cea1f88f6a9654a55708b94a0965cc9fefbf154064173f0afee37f2`；privacy-safety.json SHA256 `972185002186d9aa40df4e9dc00f759cbe0cccace11722e876ad53d0259ed4b3`。

### 独立 review 后仅两处 spacing 修正

`/root/ui65_font_audit` 指出 D 原 config `space-lg=1rem`（16 px）、`space-md=.75rem`（12 px）；原 HTML:11 父级 `gap-space-lg` 与 :123 help `mt-space-md`，所以名单标题 margin-top=16 px、help margin-top=16+12=28 px。核实际原节点后，仅将新增 scoped selector 两值 24→16 / 36→28；先前文档把 space-lg 当成24 px的记录已订正。

两处字节逆还原为上一 freeze 的完整 CSS（旧 SHA256 `19c4e7bb5d8d28970be10bc22ec0c2a06af39fa3126170bba82f76b3f04cf0b0`），其他产品内容未触碰；未重跑完整 checker。定点修正记录 `/private/tmp/caper-wave68-profile-cd/post-review-spacing-correction.json`，SHA256 `46d7a04545dbd57941a88f587fd50711fa4c00a60e9c9112252588e1d7b72ddd`；原单次 source check 中的旧 CSS fingerprint 是修正前历史快照，当前 freeze 表与 source JSON 则使用修正后 `d524bbc31f686397e95d39435e808b987975f19bb99f9bb28756fff8f25b670c`。

### 仅原场地 500 节点使用字体 alias

消息原稿只请求 Jakarta 400/600/700/800；直接共享新增 500 会改变原 `font-medium` 的 400 匹配。Root 将第 7 个新增 face 注册为 `Caper Jakarta Profile 500`；本 C 页原 HTML:73/150/218 三个场地 span 明确 500，共由 `.moments-page .moment-venue` 承载。按授权仅加 `font-family:"Caper Jakarta Profile 500","Plus Jakarta Sans",sans-serif;`，保留 color、font-weight 500 和其它值；净增 72 B。

定点核验 register 为专用 alias / weight500、官方 29,728 B payload / `1ed39614…`；逆除该 selector 声明恢复前一完整 CSS（21,921 B / `235566361ef68067ee22c90d81f2c70c1e5d4138f36532309b71402620e24e4d`）。仅逆除 root register 的唯一 alias 字面值，完整模块恢复前一 232,979 B / `41284603…`。首个局部脚本因假设 family 冒号后有空格而失败，读取实际紧凑 JSON 后更正逆除 literal；另一次 heredoc 在执行前发生编码诊断，已用配置 Python 的短命令完成局部核验。这些是核验脚本诊断，产品字体没有需修的缺陷，C 声明也未再次改动。没有重跑完整 checker、FontTools 或 API 测试。

记录 `/private/tmp/caper-wave68-profile-cd/profile-alias-local-correction.json`，SHA256 `3d8d3d7fd31ed2d5953e377cf7220263567fccaa56d6ea36d8f9fe4b75e225fa`。实际 alias 字体回调/场地节点与包体由 root 限定运行确认。

## 冻结与字节

| 产品路径 | Bytes | SHA256 | 净增 |
|---|---:|---|---:|
| `miniprogram/subpackages/profile/moments/moments.wxml` | 6,077 | `4de915c950649f81daf256ba06f4712bb406ebbfcd82006e05a578aa786120f5` | +370 |
| `miniprogram/subpackages/profile/moments/moments.wxss` | 21,993 | `ecebfccf94fa19f71b600d591efb88fa883f3866665f0d3f95bfc613362b0b01` | +11,104 |
| `miniprogram/subpackages/profile/moments/assets/wave68-back.svg` | 266 | `efeb362fc20c3e3a66fb6dc7be585f6ea7db8e9983609c44e148ef76807c3b24` | +266 |
| `miniprogram/subpackages/profile/privacy-safety/privacy-safety.wxml` | 4,366 | `823a048e3d9454acb6afdcc860d87c229a0a192584e96861b7e8c4f07528c4a0` | +41 |
| `miniprogram/subpackages/profile/privacy-safety/privacy-safety.wxss` | 12,921 | `d524bbc31f686397e95d39435e808b987975f19bb99f9bb28756fff8f25b670c` | +4,642 |
| `miniprogram/subpackages/profile/privacy-safety/assets/wave68-back.svg` | 266 | `efeb362fc20c3e3a66fb6dc7be585f6ea7db8e9983609c44e148ef76807c3b24` | +266 |
| `miniprogram/subpackages/profile/privacy-safety/assets/wave68-report.svg` | 395 | `a52c25b4c5cfb0d79e541f23d327d5b3f40a3a16af727ef7145523ab2276cdf2` | +395 |

7 个产品路径净增 **17,084 原始 B**，3 个新 SVG 共 **927 B**。这是 profile 分包文件的源字节；编译包体、字体共享成本和主包余量由 root 实测，不以原始差额冒充编译预算。2 份本任务来源/实施证据位于 docs，临时检查文件位于 `/private/tmp`，均未移入产品 assets。

## 验证与尚未完成的边界

本报告是来源与业务保护的实施自检；无新业务、VM、全量、CI、微信 CLI/SDK 或 computer-use 测试，也无 Git/矩阵修改。用户已明确不要全量或照搬实现的样式测试，故本批按批准计划做一次必要来源/保护检查；[Superpowers TDD](/Users/tsb/.codex/plugins/cache/openai-curated-remote/superpowers/6.4.2/skills/test-driven-development/SKILL.md) 与 [执行计划](/Users/tsb/.codex/plugins/cache/openai-curated-remote/superpowers/6.4.2/skills/executing-plans/SKILL.md) 中一般测试/分支流程按用户指令和 root 已批准共享执行范围落实。未删实现或追加镜像测试。

等待 root 的独立来源复核与限定微信原生渲染/点击验证。本报告不声称两页像素验收通过、全部 39 页面一致、真机或线上验收完成；真实数据长文/空态/native inset/font load/safe area 等需要运行观察。
