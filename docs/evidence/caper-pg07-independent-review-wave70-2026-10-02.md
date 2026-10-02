# Wave 70 PG07 公告问答：独立来源审查

## 审查结论 / 边界

已独立核对 PG07 原 HTML / PNG、stage frozen-product、真实动作 /权限、准确Material与inline smile、源CSS及旧页面保护。核心px /字体角色 /图形 /真实binding没有明确偏差；发现3类可定点修复的源视觉状态缺口，已一次汇总给root和owner。下文保留首次stage及3类发现的可追溯记录。owner随后已修正，末节定点delta复核通过；没有重复已通过检查。

本审查只读产品，唯一新增本报告与 `/private/tmp/caper-wave70-pg07-independent/` 证据。没有运行实施者checker、业务测试、全量、CI、微信、CLI、SDK或Git。完整微信编译、native状态 /胶囊 /focus /pressed支持与真实点击由root负责。本报告不声称原示例人物 /照片 /附件 /点赞或整PNG逐像素相同。

实施者在 PG07 stage freeze后继续同一event文件的 `_2` / `_4`，因此本审查读取 `/private/tmp/caper-wave70-pg07/frozen-product/event.*`，不把共享working tree中间版本作为PG07冻结证据。

## 1. 原输入与freeze

| 输入 | 字节 | SHA-256 |
| --- | ---: | --- |
| 原完整 `pg07/code.html` / docs `pg07-original.html` | 19,165 | `435b969b25bdfcde866d7d83d4cabf50eeae09cdc10bbd8bff10b7a2f22036d1` |
| 原PNG（已实际查看） | 560,936 | `0c9ac1263487ca7c74893da5f3f25b8374c0f9d54b493d687bd3b2f36df9588d` |
| frozen `event.wxml` | 145,449 | `2030f206abd7bf7310500350249da8a904615427bd4f6967d8cab816884fc1b8` |
| frozen `event.wxss` | 171,954 | `8d389f9d673b2fc7e2d43eb1b082f62f97700d009127b029c5138b24c947eba2` |
| protected `event.js` | 104,047 | `ccb5b5fede066ba0533b82cb564e816cc3d45ca96778a0d25ac5286d3c11a4bd` |
| protected `event.json` | 69 | `bf33dc7da099d240642a50fe3cf44cee01a2b282f70a80a313c79317c76ad10b` |

首次stage `/private/tmp/caper-wave70-pg07/frozen-owned-paths.json` SHA `268d62b28cdbf6e9af58063c0bae1aa6b1242478c4b8de77f65636f27f413211`，8产品路径为WXML /WXSS与6新SVG，共新增原始20,176 B；新增图片 /运行字体0。独立读取所有8paths与stage hash相等。素材源与CSS在 `docs/design-sources/caper-pg07-wave70/`，实施报告 `caper-pg07-reference-ui-wave70-2026-10-02.md`。

## 2. 一次聚合的source修正清单

| 项 | 原 HTML / generated CSS明确值 | stage产品位置 /最小修正 | 定点验收 |
| --- | --- | --- | --- |
| orb与badge动画 | glow为animate-pulse：2s cubic-bezier(.4,0,.6,1) infinite，50% opacity.5；12px badge是两个span，第一层animate-ping：1s cubic-bezier(0,0,.2,1) infinite，75% /100% scale2 /opacity0，base opacity.75，第二层静态lime | frozen WXML `pg07-orb-dot`只有单层静态view，WXSS `pg07-orb-glow`没有animation。限PG07补原pulse与双层ping；不改44px disc /48pxparent /blur6 /dot top−2,right−2 /colors | 只核新层结构 /原keyframes /scope，无需再核8glyph或原binding；root原生观测动画 /支持，不用固定某动画相位宣称PNG逐像素 |
| question placeholder | 原input `placeholder:text-outline`，generatedCSS最终 #737687 | frozen `.pg07-input-wrap input`的WXML没有placeholder-style，WXSS没有对应placeholder规则。只给这个source question input增加准确提示色，事实查询控件不从此源猜色 | 定点确认新增属性 /颜色，输入绑定 /value /canPostQuestion保持；root在受影响route检查显示 |
| 真实pressed /input focus | back /more /send有active:scale95；input-wrap原focus-within白底与shadow-md：0 4 6 −1 rgba(0,0,0,.1)+0 2 4 −2 rgba(0,0,0,.1) | stage PG07 scope没有按压 /focus样式。只恢复实际back /more /send与输入wrap的纯视觉状态；没有source可用能力的disabled附件 /点赞仍关闭，不新增业务method /post /成功状态 | 若用native hover-class等需限这3真实控件；focus CSS平台支持由root限定route观测。保护新绑定逻辑和全部当前权限，不为视觉引入业务动作 |

这些都来自明确有效CSS，未根据截图比例猜值。已同时向owner与root发送最终聚合清单；不要求扩成新交互功能、重新审核现有业务或全量测试。

以下看似疑点实际正确，避免误改：

- `drop-shadow-sm` 在实际generated CSS为0 1px 1px rgba(0,0,0,.05)，产品imagefilter同值；不是另一版本默认0 1 2 / .1。
- 嵌套reply源p-2.5 /py-1 /pl-3级联最终4px 10px 4px 12px，margin-left8 /border-left2 /gap10，产品同值；不按class书写顺序推断。
- header源h1有tracking-tight，17px×−.025em=−.425px；产品不是错误地把text-headline-sm默认−.01em当最终值。
- 原shadow-xs /shadow-2xs /py-0.2无有效定义，未补猜shadow或.8pxpadding。

## 3. 已完成的有效px /角色审读

header source64px /back与more44px /glyph24、person32px /glyph18，title17 /22 /600，副标题11 /14 /700 / .02em；native sticky top0和真实status +64在自然流预留，真实capsule使用既有headerPaddingRight。浏览器fixed位置由native sticky达到滚动吸顶，不把native状态栏当原截图中额外web标题栏。

main侧16px /底112+safe，welcome卡p12 /圆16 /shadow-sm、row gap12、orb parent48 /disc44 /smile28、blur6、bubblep8 /圆12 /13px leading-snug=17.875px /blur12 /原0 2 10 shadow；ambient right−16 /bottom−24 /96px /blur24，颜色均沿源。

timeline gap16 /top4、guide x19 /width2 /top24 /bottom16、thread gap12 /avatar40 /ring2 /cardp12 /圆16 /shadow-sm；hoststar16px /glyph11 /bottom−4,right−4。主办角色chip11 /14 /700 /tracking-wide=.55px，author17 /22 /600，time11 /14 /700；正文15px leading-relaxed=24.375px、公告top2；真实系统正文15px leading-snug=20.625px /p10 /圆12 /green60%背景。

reply头像24px /top2、子文本13px leading-relaxed=21.125px；reply角色 /time仅family +arbitrary10px，继承normal400 /unitless1.5后line15，产品不错误强制label-sm的700 /14px。原reply body /source role级联没有采用新profile500 alias。

composer源fixed bottom0 /side16 /top12 /safe、blur24 /0 −4 24 .06shadow、rowgap8 /max512；inputwrap横16 /纵8 /圆full /source inner shadow、实际输入15 /21 /400、附件原glyph22 /padding4但disabled；send44 /glyph20 /left2 /sourceviolet与0 4 14 .35shadow保持。额外可见closed note是当前R1能力说明，不是原PNG同字句。所有这些只证明source声明对应，真实native字形绘制 /换行 /小宽度胶囊需要root实测。

## 4. 准确glyph与inline来源

直接从保留原full decoded TTF（3,200,992 B，SHA `cf46fa438e9ce2265958fdea4498c31ae5b7b39cb172ebff4f6aedb5aedcbc90`）实例化对应FILL /wght，不重新下载或制作新font。PG07后置官方lastface与Wave69来源相同，WOFF2 1,136,920 B /SHA `77f9711f3f896a1d7a34ab95cffc45cfb17d84c223f197c1b90faa0d043006e9`，Version2.972 /v374、FILL0..1 /wght100..700、固定opsz24 /GRAD0。

8项实际runtime Material的原full path、保存manifest path、viewport与case-normalized填色全部相等：back400/F0/24px、more400/F0/24px、person400/F0/18px；star400/F1/11px、campaign400/F1/20px；closed favorite400/F0/15px、disabled image400/F0/22px、arrow_upward400/F0/20px。

FILL1实例实际active rclt lookup1把star→star.fill、campaign→campaign.fill；独立证明应用了该置换后再画最终glyph，不仅凭filename或FILL参数相信filled轮廓。两个没有runtimePath的参考原图附件image13px、红色已赞favorite FILL1未插入产品，不能制造附件 /已赞。

inline smile的原circle /path /stroke attributes与产品子节点完全相等，仅currentColor解析为源on-primary白与xmlns；viewBox和fill相等，无自画替代。来源许可复用Material Apache2.0，字体二进制仅docs /temp，无新运行资源。

原后置Jakarta100..900请求失败 /实际可用范围与之前字体边界保持；本页复用400 /600 /700 /800，不制造900字节，不把CSS family字符串或source PNG当fonts成功加载证明。

## 5. 真实权限 /绑定 /全字节保护

本独立观察只做一次有效source /glyph /保护pass。最初XML观察只转义attribute而漏掉合法WXML text Mustache的 `&&`，在immutable baseline line340失败；观察器补rawMustache转义后完成，产品不改。这不是微信编译 /业务失败，也没有重复已完成checker。

| 独立保护 | 结果 |
| --- | --- |
| WXML完整逆除新PG07nav /scope /rootclass与旧header排除条件 | 与immutable69完整137,918 B逐字节相等，SHA `27614e27494fa920cff810a633ff5f89e4ad7ca1c839c09b7fa902ba4588fd3a` |
| root已授权费用资源路径例外 | 仅2处 `/assets/stitch/pg09_expense_rooftop.jpg`→`./assets/pg09-expense-rooftop.jpg`，也已逆回纳入完整byte证明；图片移动由root负责，不是PG07自行更换图片 |
| 旧CSS完整prefix | 162,268 B同字节，SHA `794cd1b6235a51eb59d080e016b2a6faa08f7b85e44d189e3d379a852e441838` |
| stage JS /JSON | 与immutable69完全相等；没有新method、接口、权限投影或页面状态 |
| 8个原content交互 | tag /bind与catch /data /value /disabled /id和scope内部全部wx条件 /循环祖先多重集合相等，无missing /new |

8契约包含真实问题输入与askQuestion、事实输入与askFact、refresh、row.id回复、本人拒绝内容和reply拒绝内容的复核； source原稿handleSendMessage只是清输入和临时改placeholder，未复制为“已发送”成功。产品实际提交仍由原服务端审核，不能把原DOM动画当R1成功。

新mode外层条件READY、contentSection、无success /joinConfirmation；真实作者 /timeLabel /statusLabel /body /row.replies /moderation_reason全部读当前contentTimeline。可回复只限APPROVED问题、当前版本 /当前活动live状态，以及isHost或canManageAnnouncements；旧fact版本提示保留。canPostQuestion /canUseCollaboration与终态说明没有被视觉改动放宽。

原3个实际nav方法goBack、openEventActions、跳registrationSection均复用当前行为。新增静态closed附件没有bind，点赞只是灰outline和可见未开放label，没有计数 /成功按钮。sourceLuna /Alex /Momo头像、12/12和现场标牌不放进真实事件。

因此保护证据只确认现有业务 /资格没有被本视觉恢复改动，不重复历史业务套件或声称所有API当前成功。root按实际角色 /同ID /版本完成受影响有限route验证。

## 6. 独立证据与待delta

`/private/tmp/caper-wave70-pg07-independent/independent-source-and-protection-proof.json`包含8pathfreeze、完整逆除、8契约具体attrs与条件、8runtimeglyph的full实际rclt /path /填色 /viewport、inline子节点结果。source /CSS /原PNG对应hash见本报告与owner来源manifest。

3类source样式修正由owner实施；本审查者只读局部新增decl /WXML结构及逆除恢复首次stage，不重跑原8bindings /fullbyte /8glyph检查。root负责native支持、权限与可见composer的限定点击，以及最终CLI /activity包体。`_2` / `_4`与首页B/C/D将按各自最终freeze另行独审，不以PG07通过覆盖它们。

## 7. 三类最小修正的最终定点复核

owner确认 `/private/tmp/caper-wave70-pg07/frozen-product/` 已更新为仅这3类修正后的PG07阶段副本；共享event工作树包含后续详情中间版本，不用于此复核。更新stage manifest SHA `42325bb31d195a4c58a74cbeb050e565b10dc2599b5e50a5d793a9d78b01d0ba`；8路径不增资源，原始净增更新为21,257 B。

| 最终stage | 字节 / SHA-256 | 仅新delta逆除 |
| --- | --- | --- |
| event.wxml | 145,698 B / `63cf9c1d5a4c3e3917321e6a266a39144ac31a65fd7036de028c74c9ec088313` | 5处表现属性 /双层badge，+249 B；逆除完整恢复首次stage `2030f206abd7bf7310500350249da8a904615427bd4f6967d8cab816884fc1b8` |
| event.wxss | 172,786 B / `14cb53da5e65bc779a24c2de306c24f2d795eaa06c728e6c908f0addfb9d22d7` | 2原规则替换与1尾部纯表现块，+832 B；逆除完整恢复首次stage `8d389f9d673b2fc7e2d43eb1b082f62f97700d009127b029c5138b24c947eba2` |

已只读核原generated CSS /HTML与新增delta：pulse 2s、ping 1s、准确easing /关键帧 /base透明度和12px双层结构；question placeholder准确 #737687；back /more /send仅native hover-class缩放.95；input-wrap仅白底、原shadow-md与150ms原transition。没有新增业务handler /value /权限 /写入，也没有改变6SVG。按proof仅逆除这1,081 B新delta，整体恢复已经独审的阶段；不重跑8契约、Material或旧scope保护。

独立delta证明 `/private/tmp/caper-wave70-pg07-independent/independent-source-correction-delta-proof.json`，1,773 B，SHA `59f6c35dbe6ea8cf6dfa752bb609d0a9f6bb34a9f265293eb6e945620cd3b8af`。owner同轮proof `docs/design-sources/caper-pg07-wave70/review-source-correction-proof.json` SHA `92b8af436065c57d507bd36b9e09cd989c2e2b9a0ed7fa830a6c4578913e55c4`。

本独立来源审查的3项已修正，没有待实施的source差异。`:focus-within`、native hover与动画实际微信支持仍须root受影响route观察，静态规则相等不代表平台实际生效；不能据此声称PNG人物 /附件 /自由AI或整页逐像素一致。

## 8. 最终一个 tracking-wide 源数字纠正

owner随后按同一保存的原generated CSS核出主办chip的tracking-wide=.025em：11px应为.275px，首次stage的.55px多一倍。只改`.pg07-role-chip`唯一数字，+1 B；不会影响已核的嵌套reply chip（其独立letter-spacing0保持）。这是首次源审未列出的数字差异，现记录纠正，不能把早前hash冒称最后产品。

已独立仅核该一个替换：最终stage WXSS172,787 B /SHA `c72cc63700e156013af0e9b2c134e4413516167d5f7a2bfcd82a327e36d8e469`，逆除完整恢复前节已审 `14cb53da5e65bc779a24c2de306c24f2d795eaa06c728e6c908f0addfb9d22d7`。WXML仍`63cf9c1d5a4c3e3917321e6a266a39144ac31a65fd7036de028c74c9ec088313`。最终PG07 manifest SHA `5afe48c6450924b442d69aeec1952984b32ef15b884467b82898c21f3a4de393`。此一步不重跑8契约、8glyph或之前3修正检查。

owner定点proof `docs/design-sources/caper-pg07-wave70/final-chip-tracking-proof.json`；独立delta `/private/tmp/caper-wave70-pg07-independent/final-chip-tracking-delta-proof.json`，含唯一count、完整逆除hash。实际native focus /动画边界仍同前节。
