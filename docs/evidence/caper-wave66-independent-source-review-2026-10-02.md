# Wave 66 独立来源与状态保护审查

日期：2026-10-02。Reviewer：`/root/ui64_review`。本报告独立审查任务 B（create IDEA）与 C（PG01 普通羽毛球访客），不是本人实现的消息页 A 的独立审查。消息页只作为本轮总预算输入。本轮只读产品、原稿、快照与来源证明，仅写本报告；未修改产品、实现者 evidence、字体、总矩阵或 Git，未操作微信、CLI、SDK、computer use，未运行业务、全量、CI 或新样式镜像测试。

**结论：本次发现的 6 处明确原稿偏差已由各 owner 修正，复核最终两页的来源、业务字节和状态保护后，未发现本轮范围内仍需阻止同步的源码缺陷。这个结论不代表微信运行、精确字体字形、整页像素或全部 39 屏验收通过。**

## 1. 完整参考输入

已阅读本轮完整计划 `docs/superpowers/plans/2026-10-02-messages-idea-visitor-reference-ui.md`、Wave 65 原稿差距盘点，重新阅读完整两份 HTML 并查看完整长页 PNG。产品文件采用完整 byte/inverse 校验、完整旧 CSS 前缀保护校验，加上逐条阅读新 markup、新 CSS 与 header helper，避免只看 owner 摘要。

| 原稿 | HTML B / SHA-256 | PNG B / SHA-256 / 尺寸 |
| --- | --- | --- |
| `pg03_ai` | 20,435 / `a9dcecb66acbfe35c004d66b178dd3594197b2d5b1688c6feaada09a30ca0497` | 486,721 / `b6cfb7394783c1793a823be7065822a14ce38c635eaaead09467aa9506b78463` / 718 × 1600 |
| `pg01` | 27,174 / `ae12d6f11a51ffaccae03ae8b27f02144ee6f4c00a072e75edb933ff1aea88c4` | 518,883 / `33cd936b61a39af9f4d18220897ee48283de72153bf6e286d478147eda0b52a2` / 532 × 1600 |

两份原稿均来自 `/private/tmp/irl-stitch-original/stitch_design_system_generator/`。尺寸从原明确 CSS/Tailwind 值及有效级联取值，不从缩放的 PNG 反推。`pg03_ai` 是 device-width；`pg01` 的 max-width 是 425 px，当前范围不会触发原 `sm` 640 px 分支。

## 2. 已提出并修正的来源偏差

| 位置 | 首次 freeze 的问题 | owner 修正后复核 |
| --- | --- | --- |
| create `.popular` | 背景 `#fff0f4`，原 `party-pink-soft` 明确为 `#FFF0F3` | `#fff0f3` |
| create `.inspiration-icon.icon-2` | 同上 | `#fff0f3` |
| create `.orb-tag` | 行高 14 px，把 `font-label-sm` 当成 `text-label-sm`；原实际 `text-[10px]` 默认 1.5 | 15 px |
| create `.idea-quote` | 同一 role 误读；原 `text-[12px]` 没有 `text-label-sm` 或 leading override | 18 px |
| event `.pg01-copy-info` | 14 px arbitrary font 被按 `text-sm` 行高写成 20 px；原 button 没有 leading override | 21 px |
| event `.pg01-poster-tagline text:last-child` | 只取原 `text-[15px]`，漏掉同节点 `text-lg` 的覆盖 | 18 px / 28 px |

最后两项的级联依据另核了官方 Tailwind v3.4.17 原始源码：候选按 ASCII 排序，同字号 utility 的顺序稳定，`text-[15px]` 排在 `text-lg` 前；`text-lg` 的标准值为 `1.125rem / 1.75rem`。这是对源码规则的推导，未运行原稿浏览器或把推导写成微信测量结果。[候选排序](https://raw.githubusercontent.com/tailwindlabs/tailwindcss/v3.4.17/src/lib/expandTailwindAtRules.js)、[utility 顺序](https://raw.githubusercontent.com/tailwindlabs/tailwindcss/v3.4.17/src/lib/offsets.js)、[默认字号／行高](https://raw.githubusercontent.com/tailwindlabs/tailwindcss/v3.4.17/stubs/config.full.js)。

| 官方固定 raw 文件 | B | SHA-256 | 原字节行位置 |
| --- | ---: | --- | --- |
| `expandTailwindAtRules.js` v3.4.17 | 8,242 | `7a29e3b220512d09004d9cd6e92ccad3b3bd24a5d6b8ee9dd8b4203c9336bb3d` | 163–169 |
| `offsets.js` v3.4.17 | 12,190 | `0fd4868b2aef3415ea7c1ee8b91efbecc916a5afa2c7887be03ace0a415edd80` | 276–277 |
| `stubs/config.full.js` v3.4.17 | 24,958 | `8f3394e8a4990a7b678d3462b6e1440b84c11a6c06e55d7b26108b90a1fcc538` | `fontSize.lg`；默认 spacing、opacity |

web 工具显示行号会归一化，因此最初发出的 151–159 / 257–258 后已纠正为上表 raw 行号；原 bytes hash 已分享给 C owner。Reviewer 只读获取原 bytes，没有写下载缓存或把这些源码装进应用。其默认配置还确认 `opacity-15` 有定义；未把合法点阵 opacity 当作缺失类提出改动。[默认 opacity](https://raw.githubusercontent.com/tailwindlabs/tailwindcss/v3.4.17/stubs/config.full.js)。

修正后仅复读对应选择器和更新后的 freeze hash，没有扩大或重复已通过的业务／资源检查。

## 3. B：IDEA 几何、图形和业务保护

### 原稿有效尺寸与明确适配

核到 56 px fixed 动作行、横 16 px；返回 hit 44/glyph 24、草稿高 32/p横12/glyph17、profile32/glyph18。IDEA 主内容横16/顶8、栈gap20；球80、眼8×10/gap10、反光20×10、腮红6×4、粒子14、tag6°；输入 r24/p16/min168、send40/glyph20、count dot6；灵感 gap10/r18/p14/gap14/icon44/r14；fixed tray 横16/上12/下32+safe，主按钮py14/px24/glyph22及原三段 gradient。

`h-13` 不在原 spacing 里，最终没有虚构 52 px 固定按钮。原 `vibrant-lime: "D2F803"` 缺 `#`，最终粒子背景透明，只保留原明确有效 `#D2F803` 光晕；底部箭头按有效继承为白色。这与原 PNG 的透明粒子和白色箭头对应，没有自行修成 lime 实心。实际 textarea 4 行通过明确源字体/leading 换算为 97.5 px，这属于微信组件适配，不宣称浏览器 rows 实测。

`headerActionInsets()` 只把正常 draft `inset+34` 改为 `inset+40`，fallback146改152。原32 px profile因此与draft恢复8 px间隔，菜单前保留既有8 px。FORM 共用该 helper，FORM draft pill 同样移动6 px，是本轮批准的必要几何例外；不能称该位置完全没变。IDEA glyph 条件分支与新样式隔离，FORM/REVIEW 原 header 字符和人形分支保留。

### 独立完整字节结果

Reviewer 独立读取原 snapshots 与当前完整文件，结果：

- 两处 JS 常数准确逆改后完整匹配 39,839 B baseline，SHA-256 `23257bc0590551c7c507f0bc83fa73881051cb8e8a415e8bb7600bfef7ca8118`。
- FORM 开始至 REVIEW／重大变更确认结尾完整同字节，suffix SHA-256 `ae0d41396fcec9f64b3eec6c7ab235b6c6aa395a90991ddb71f6849ff1ad1483`。
- 95 个事件、178 对事件/data/disabled/value/maxlength/checked 属性序列同值同序，独立序列 SHA-256 `807029aba12d447e305c4786b06b5e6a74bac05d4279b595a0de412b8891873b`。
- 旧 CSS 前 19,819 B 完整同字节，SHA-256 `8d3681482c5f41c4665eaa67e65b675484a8c41d88bb4ad0240e6ad7f8d5094a`。新规则是 `.stage-IDEA`，新 keyframe 名独占，仅由 IDEA 使用；FORM/REVIEW 不吃新局部样式。

真实慢请求、取消、手动、disabled、未开放类别和本地规则说明保留。未导入源假字符数64、示例完整描述、1200 ms假成功或未开放的源第二批类别。

### 准确 Material 资产

独立核过10张 SVG / 2,701 B：八个原名称，`arrow_back_ios_new` 的三种原颜色变体。所有 official source bytes hash 匹配固定 Google commit `bd8cb85bd4bad964fe6918f79665bb40c3a8efef`，SVG children 与官方 glyph 相同，root 除明确 fill 配色外所有属性同值；Outlined、opsz24/wght400/FILL0/GRAD0，无 FILL1、Phosphor 替换或路径重画。官方 LICENSE 与已有 docs Apache-2.0 原文同字节。

来源清单 `docs/evidence/caper-create-material-symbols-sources-wave66-2026-10-02.json` 5,672 B、SHA-256 `9619d6df4e2c5480ce1ea148a3a18755cdb5322bb552cacae5759d922166824f`。实际页内 assets 目录仅10张 SVG，旧页内 manifest 路径已不存在；该清单没有进入主包。没有新增字体或照片。

## 4. C：普通羽毛球访客、原图形与安全边界

新 nav/poster/sheet/footer 四块和根 class 均严格使用同一状态条件：

`READY && detailsSection && !successState && display.isBadminton && !isHost && myRegistration.status !== 'CONFIRMED' && !joinConfirmation`。

旧 topbar/poster/detail/footer 用补集 guard 保留。generic、host、CONFIRMED member、成功页、其他 section，以及确认打开时均不启用新访客层；新 nav 位于独占类下，其他追加样式为 `.pg01-visitor` 或 `.event-page.pg01-visitor`，没有全局覆盖旧 `.poster` / `.detail-section`。

### 独立完整逆还原

- 去掉四个新块、对应 guard 和 page class 后，原完整 WXML 精确还原 SHA-256 `92da3fc366ce0b32863cfb82f2ae1e310482e27ca168a2db21bdc2e33f51c276`。
- 去掉新增的 `headerPaddingRight` helper、data字段及onLoad几何字段后，完整 JS 精确还原 SHA-256 `511d72c878c18d391304523180ea6baae8151322bbc59a73490c0ba385b01a4d`。其他 status 算法、身份、报名、审批、退出、成员、签到、费用和服务端代码字节保留。
- 旧 CSS 前 **86,849 B** 精确同字节，SHA-256 `426a994e9c6538aa99685d0bf060616bbeef29fe16dc4b2c93a284305ebbc008`。新84条局部规则只命中新 scope。
- 新旧 `joinButton` 的安全状态/canJoin/riskPaused/recruiting/event.status 条件和 `openJoinConfirmation` 绑定同值；新可见动作仅调用已有真实 methods，没有创建假地图、假个人主页、假席位或假分享结果。
- 新访客 sheet 保留真实时间/场地/hostAlias、授权昵称、审批与人数细项、场地声明、取消、审核版本、暂停、危险说明、举报与可信任人复制。未复制 Léo、16 人、原示例日期或静态成员照片。

### 原稿几何与资源

核到海报 max425/aspect4:4.8、三色/18点阵/径向光；源轨迹与球拍/皇冠；42/50px headline、−2.5°，白tagp6×12/−1°，badgeborder2.5/p10×14/r16。原系统栏与时钟不复制；新原生 nav status+56、36px圆、back20/share16/more20，真实菜单left前至少8px。sheet overlap24/r32/p20×20×32；facts40/r16/glyph20/gap14/rowgap16；hostp14/avatar48/halo2；meta source两列及seat层级；底部p横20/上14/下32+safe/gap12，真实副按钮文字和copyVenue能力保留。

`h-84` 无源定义；现有照片使用widthFix/width256/top48/right−24/−3°，没有猜336 px。已复核 JPEG 36,028 B，SHA-256 `9d3ffba93e70736ff1d8d72c3f8387e2a7f3e4fafca6c0a9f56b1be2fb03db88` 同字节，未复制新照片。它是留存示意图，未验证与源远程图片逐像素同值，不能把本场照片或原图完全相同当成通过项。

独立核过14 SVG / 4,228 B：12张原 inline 的精确颜色/描边变体＋2张 Material Outlined。原15 inline中排除2张模拟status并复用同路径chevron；所有源 child XML 同字节，root 仅加xmlns、去web class/id、解析currentColor，track加原opacity0.4。球拍白20%不污染child lime线；crown `#FFE600`；back/share-white/more白、chevron/meta灰400、底部share及Material灰800。venue/host chevron仍stroke2.2、seat为独立stroke2，没有仅同名而丢失描边差异。

calendar_today/location_on 的固定官方 source bytes与精确children匹配，opsz24/wght400/FILL0/GRAD0，只根fill为 `#1F2937`，许可沿用相同Apache证明。所有 glyph/root/name/color/reference对应已实际检查，无 Phosphor或字体混入。

完整来源清单 `docs/evidence/caper-event-visitor-reference-sources-wave66-2026-10-02.json` 12,321 B、SHA-256 `5e4eb9c0711e990719fd8b6e6c5c566d51dc913a14c858f8909c84e7f65041ee`；只在docs，无应用 manifest。原稿字体 family 恢复不等于 font face 900 italic/Caveat等准确加载，owner已明确这部分未新增字体，本审查保留该边界。

## 5. 最终产品身份与证据

| 最终文件 | B | SHA-256 |
| --- | ---: | --- |
| create.js | 39,839 | `ed71d3750551182c6676c8c71e204f1396343d5f5eb46a84f6fde1ff0847d4ef` |
| create.wxml | 29,086 | `b5d424441a75206f0d71e5f4b6d7cc0a82cbc1aef4aa4091293a61dbcb120131` |
| create.wxss | 29,928 | `4a23898ee332fcefc018093d54ac7d8a986b66404f5a3e75a23445b60760c5cd` |
| event.js | 104,032 | `7aba63388c13daae75f2485cf31bea5ab0bd7db1a1568e293a03b31240fd7605` |
| event.wxml | 87,816 | `265efb383b028a8368166578b04f78f03493020180fdf2363b7aefbd33aaa744` |
| event.wxss | 98,830 | `72bd3f539753dc0c2bbb2da5dcce33fd1ee6514d0dcbe71f7ded3268e7b5f4f9` |

产品路径均在 `miniprogram/pages/create/` 或 `miniprogram/pages/event/`。资产逐项hash保留在相应来源清单与owner freeze，Reviewer已独立逐项比对。实现证据：

- `caper-create-idea-reference-ui-wave66-2026-10-02.md`：12,590 B，SHA-256 `ab9e95401c803b5dc916f47aa6498b94afb4b9c8486abc5f8a263351b7b2006a`。
- `caper-event-visitor-reference-ui-wave66-2026-10-02.md`：10,632 B，SHA-256 `984d5df99e19f49e997706e15b6584c18f8a305517a49f81b5b6da57ed5c39b9`。

两份完整逆还原／来源 inspections exit 0；针对修正项只读查看最终规则和hash，没有新增产品测试文件。实现者的3分支/7分支 helper VM是其各自证据，本审查没有重复跑VM或把这些算术输出称为微信运行结果。

## 6. 主包预算与剩余验收边界

根代理提供的 Wave 65 实际主包为 **2,046,014 B**，距2MiB尚有 **51,138 B**。本轮应用原文件净增：消息6,378 B＋IDEA14,496 B＋访客29,131 B＝**50,005 B**；单纯原文件算术仅余 **1,133 B**。这是预算提示，实际编译压缩/打包会改变结果，不能据此宣布包体通过；root必须最终preview测得主包 <2MiB。来源JSON、报告、官方源码和font proof均不混入应用主包。

剩余验收明确为根代理的有限原生渲染／点击：消息A的独立review及INBOX路径、IDEA输入/灵感/未开放/手动FORM往返/草稿与个人入口、授权访客海报/sheet/copy/menu/报名确认打开取消；回看受保护FORM/REVIEW、host/member/success/其他section不串样式；精确字体运行状态、最终包体、同tree提交上传。

本报告没有验证微信渲染、sticky/fixed的实际窗口几何、全部按钮真实点击、后台API成功或真机；没有覆盖其余长页模块、39屏整体pixel、正式AppID/HTTPS/订阅消息/真人运营或三场受控活动。这里的源码通过不替代这些验收，也不作为全项目完成百分比。
