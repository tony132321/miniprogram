# Wave 71 PG06-S 分享背景：独立来源审查

## 结论和边界

已完整读取原PG06-S HTML和最终background WXML /WXSS、实际查看原PNG，并读取现有share只读projection /host权限 /账号 /版本守卫。一次独立来源、readonly、隐私字段和旧foreground /`_3`完整inverse核对通过。原source未定义的pending状态曾引入新amber颜色，已授权只改为原source中性#efedf3 /#424655；此两色delta单独逆除准确恢复原freeze，其余产品不变。

只新增本报告和临时独审proof，没有改产品 /配置 /字体 /矩阵 /Git，也没有运行owner22执行器、12glyph全轮廓核对、业务 /全量 /CI /SDK /微信 /CLI。当前结论是静态来源保护，不能证明实际canvas遮挡、原生层叠、按钮点击、所有39屏、真机或外部环境通过；root限定截图和同ID路线是另一层证据。

## 1. 精确原输入和最终freeze

| 输入 | 字节 | SHA-256 |
| --- | ---: | --- |
| PG06-S HTML | 25,536 | `ae332500609017a0a0d467d88b52ff0942e3b2824dc542e8f5bd65e5e18527c5` |
| PG06-S PNG | 294,902 | `25784a100075b14dccb1f3e0b0a562df4ffc9f5ef90f5dacfa900138a4b848f0` |

用户原文件在 `/private/tmp/irl-stitch-original/stitch_design_system_generator/pg06_s/`；同HTML与原ZIP entry来源证明保留在 `docs/design-sources/caper-share-background-wave71/`。背景审查不再次执行ZIP比对或此前foreground检查。

最终产品副本 `/private/tmp/caper-wave71-share-background/frozen-product/`；manifest `frozen-owned-paths.json` /`frozen-product-paths.json`在同prep目录，来源目录 `docs/design-sources/caper-share-background-wave71/`，owner实施报告 `docs/evidence/caper-share-background-reference-ui-wave71-2026-10-02.md`。

| 最终产品 | 字节 | SHA-256 |
| --- | ---: | --- |
| share.wxml | 18,371 | `ce0132c7578ec2b4a1b6a1d4f528c2566e29819a72e7dc7f17ffec01aa272a60` |
| share.wxss | 32,129 | `c49dc766a42b6e37bbab256a4262417ad0ca991c53f9c6f3f1d67f3ef199cd4b` |
| share.js（root QR require既有例外） | 27,268 | `8ab001ad92a8e911fc8b7e84934872d418a9d541c506ce42efbce1472373ab3d` |
| share.json | 75 | `95f4181c4eb25045c994138c56d0741f84443d00426599975f8a3fe4f24e4262` |

Raw activity模板 /样式新增18,656 B，runtime素材新增0 B、main新增0 B。不可由raw字节推导最终微信压缩包体已过；rootCLI最终实测才是门禁。

## 2. 完整原source /必要平台适配

Source header内容56px、side16、back/more44 /glyph22、person32 /glyph18、24pxblur、17/22/600/−.17标题。原absolute页面居中标题在实际微信capsule占据右方后使用剩余flex空间居中/截断，这是明确native几何适配。系统statusBarHeight/headerPaddingRight来自原helper；不复制9:41、WiFi、电池、信号mock。

原hero16:9/p16/r16/shadow-sm，title22/28/700/tracking-tight−.55，绿badge11/14/600/.22，facts13/16/600和16glyph白80%，−6°social sticker p4×10/r8/blur12 /11/13.75/800/italic/.275准确。真实城市只到city字段，没用具体场馆地址填背景。

原HTML照片和scrim是`-z-10`，hero未建立自身stacking context；实际原PNG经前景overlay模糊后，首card照片 /白文案几乎不可见，仍呈白底。最终背景保留这项source负层级和opaque main，未主观改成深色照片hero。这里不能把“静态CSS写入”当native实际层叠通过；需要root实际截图观测原image child/canvas行为。

四统计gap8、p10/r12，数22/22/800/−.44、mb4，标签11/14/500/.22；原旧API无取消数，所以第四栏显示实际requested /待审核。无假6/2/3/0和原假取消统计。Sourcefont request400/600/700/800；CSS源500声明保持而不套profile500alias或新增globalface，实际字形matching未由本静态报告宣称验过。

原member card p16/r16/gap12、heading17/22/700/−.17/count13/16/600；此share页面实际没有加载名单，只保留单个通用匿名44px符号和“未加载成员名单”说明，没有与confirmed人数一一对应的假头像、Luna、+1、技能或信用。source人物样例因此明确不等同真实R1画面。

助手卡源blue-soft /violet-soft /white渐变，p16/r16/gap12、36pxFILL1 lightbulb容器、15/20/700heading、13/17.875正文；文本是“已授权活动快照、操作返回工作台”，不声称AI已推送 /自动提醒 /预订场馆。成局框源p16/r16、row gap12/mt14/pt4、左15/21/500，右13/16/600（第二行13/18/400），绑定真实minimum和host核实声明；没有静态三天倒计时或“场地已预订”假事实。

原底部3操作card仅背景views、无actions，保留source三列 /gap10 /pt4、p12×8/r12 /22glyph /13/16/600（末700）；overlay覆盖期间没有新后台完成/取消/发公告动作。旧foreground实际微信分享、复制和海报动作完全未改。

footer源pt20/pb8、第一行13/16/500/源wide.325，第二行只有family token+arbitrary10px，继承body21px/400、widest1px、opacity.7/mt4；没有把family class误当11px14px700或人为补15px行高。

## 3. pending两色来源纠正

原绿色成局badge仅对应条件具备；真实条件未具备应继续“仍需核对”。owner初版pending用#fff4de /#8b5710，不在原PG06-S palette，独审预读发现后向root和owner明确反馈。root授权唯一两常量改成原 `surface-container` #efedf3 /`on-surface-variant` #424655，真实guard /文案、其他字节未动。

最终32,129 B的CSS逆回这唯一rule两色，与初始 `219f0221f85a46093fe19d16531a91463dec085c07a02574045de11e855de3ac` 整文件精确相等；未重复owner22checker。原初版副本保留 `frozen-product-initial/`。来源delta见 `docs/design-sources/caper-share-background-wave71/pending-neutral-correction-proof.json`。

## 4. 只读与隐私 /资格边界

新背景guard仅`shareSheetOpen && loadState === 'READY'`，根fixed layer40 /opaque #faf8fe，低于原foreground50；pointer-events:none和aria-hidden。背景没有button /bind /catch /open-type /canvas /routing /data-id /data-section，关闭foreground后background不在树中，原`_3`页面恢复。旧canvas令牌生命周期不迁移，实际native canvas遮挡仍需root核。

实际background Mustache字段只限display.title /status /date /end /cover /confirmed /minimum、event.status、payload.city /venueStatus、stats.reserved /waitlisted /requested。没有inviteToken /sourceToken /具体venueName /display.location /hostId /userId /registrationId /费用 /金额。名单没有循环；单匿名符号不能看作每人头像。city只用现有字段，不从具体地址生成。

share.refresh仍原host检查：当前actor /identity /loadGeneration、返回event.id匹配，非host设FORBIDDEN并清event/display；无actor设UNAUTHENTICATED；加载和账号切换清sheetOpen/sourceToken，资格失效 /deadline和失败沿既有guard。背景没有新增GET /POST，未因其展示放宽邀请码有效性或账号/版本检查。此前root QR require只作分包路径无损迁移，JS其他byte不改。

## 5. 现有准确素材复用 /不重复全图审查

12glyph使用同activity分包已有准确资源，当前真实consumer集合与owner `glyph-source-reuse.json` 精确相同；该既有证明按原最后fullv374 /Version2.972、wght400、FILL0/1、fixed24 /GRAD0逐path和paint核过。lightbulb /check_circle FILL1有active latn rclt `.fill`，calendar /location白80%alpha已证明，Material仍Apache2.0。

本次只读取这份已证明来源和12实际引用集合，没有重新实例化全font、重复12轮廓hash检查、下载字体或增加图库。现有PG06-S原羽球示意`sheet69-badminton.jpg`40,193 B /SHA `277b7d72221482111ee7799a958cd0c08ee7897fcb60f31900d1fcc68f293769`，同原HTML literalURL，不新下载 /重编码；matchedbadminton才用该原图，其他cover原classifier保持。新背景明示“原稿场景示意图”，不声称真实活动照片。

## 6. 一次独立inverse /动作核对结果

独立proof `/private/tmp/caper-wave71-share-background-independent/independent-readonly-inverse-proof.json`，2,640 B /SHA `840eb52b795aaf7071f1d6e2c23aab3d625158d10e78ede1e14d6030ca7302f5`。

| 限定核对 | 结果 |
| --- | --- |
| 最终WXML chunk逆除 | 整份恢复immutable69的`_3`+foreground11,692 B /`94fcd4751620f77782db3852bb6be73668b3f82f73a8db1286c99ce0f2577fca` |
| CSS append逆除 | 整份恢复immutable69 20,152 B /`3f69b34649e84e0b0354038fad2be585423e7c5b33e2579f6d8bdf727c78d743` |
| pending两色局部inverse | 整份恢复初始219f0221…；其余byte不变 |
| JS root require单行inverse | `../vendor/qrcode.js`→`../../../vendor/qrcode.js`后整份恢复69 /SHA `5fdde14c88902bb18e4c045d81326974978d718c6181d94cf76c86f2177a8258` |
| JSON | 完整69字节不变 |
| 旧真实16动作 | 完整tag/attributes及顺序相等，包括bind/open-type/data/aria/disabled；新背景0动作 |
| 新background字段 | 无任何新token、具体地址、用户identifier或金额绑定；原read-only/host守卫不改 |
| 12消费者 | 集合准确等于已证明12资源，无新增二进制 /素材 |

未运行owner22执行器、以前foreground /business或12glyph全审。当前已明确的来源问题只有pending两色且已解决；其他源假头像 /静态人数 /具体地图路线 /支付 /倒计时以真实R1边界处理。最后root只需同ID真实host分享打开 /关闭、foreground原操作、nativecanvas层叠 /capsule /换行 /源whitehero及最终包体，而非重跑全部工程。
