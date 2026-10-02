# PG10-A/B 原稿视觉差距只读审计 · Wave 60（2026-10-01）

## 范围与证据边界

只读核对原 ZIP `/Users/tsb/Downloads/stitch_design_system_generator (2).zip` 的 `pg10_a_edit_profile`、`pg10_b_social_badges` 两组 `code.html` 与 `screen.png`，仅将这四个源文件提取至 `/private/tmp/irl-ui60-profile-ab-audit/stitch_design_system_generator/`。阅读当前资料页、勋章页、共用样式及“我的”入口源码，并阅读 `docs/stitch-ui-parity.md:225-226`、E103 的 Wave44 空态证据和 E107 的 Wave45 勋章分享证据。未运行测试、模拟器或实现修改；没有同设备截图测量，以下是可修正的源代码 token 差距，不能声称逐像素通过。

换算以 375px 视口为基准，1rpx = 0.5px；Tailwind 默认 1rem=16px。原 PNG 为导出的长图，视觉形状由 PNG 辅助核对，数值以 HTML 为准。本文 `A HTML` / `B HTML` 指上述两份提取源文件；当前路径均相对仓库根目录。

## 共用页壳与图标

| 优先级 | 原稿及源行 | 当前源码及源行 | 可修正差距（375px） |
| --- | --- | --- | --- |
| P1 | A HTML:3-5、10；B HTML:3-10：Plus Jakarta Sans，17px/22px 标题、600；header `h-14`=56px，左右16px；back/options 最小44px；person32px | `miniprogram/subpackages/profile/common.wxss:1-5`、A/B WXSS:2-8 | 当前 header46px，标题16px且未指定22px行高；页边距15px；back37px、more24×27px、person27px。页内可独立恢复56px顶栏、34rpx/44rpx标题、32rpx页边距与64rpx头像。保留微信胶囊 `headerPaddingRight` 避让及状态栏，不用原稿右上绝对坐标压住胶囊。 |
| P1 | A HTML:10、31-32、39、52、61-69、87、94、159-170；B HTML:34、73、149-244、291：Material Symbols 图形 | A WXML:2、4、6、16、18、21；B WXML:2、4-5、9；`badges.js:5-13` | “人”“⌕”“♧”“✦”“♡”等文字字符替代人物/相机/定位/网球/奖章/握手/步行/庆祝/喇叭，轮廓、基线和字宽明显不同；咖啡 emoji 也受系统影响。用本地图形资产或等价矢量，明确对应原 symbol 名称及大小，保留原绑定和未开放说明。 |
| P2 | A/B HTML:5：surface #faf8fe，on-surface #1a1b1f，low #f4f3f8，high #e9e7ed | `common.wxss:1-2`；A WXSS:26、44、48、59；B WXSS:55 | 当前画布#f8f7fc、顶栏#faf9fd、输入#f1f1f6、灰标签#ecebf1；固定栏又沿用#f8f7fc。可逐页恢复源色值，勿直接改共用样式影响未审计页面。 |

字体加载与授权需按工程可交付资源解决；当前未发现这两页使用原字体或 Material 字体。中文仍依赖系统回退字体，故不得把只改字号称为字形完全一致。

## PG10-A：资料页

| 优先级 | 原稿及源行 | 当前源码及源行 | 可修正差距（375px） |
| --- | --- | --- | --- |
| P1 | A HTML:27、31、36：头像96px外框、3px内边；相机32px；handle13px，横12/纵4px，顶距12px | A WXSS:17-22；WXML:4 | 头像84px内容+7px总边框=91px外框，边框3.5px且白色；相机27.5px、错位 right=-2.5/bottom=-3.5px；handle11px、纵4.5px且没有源复制图标。可保留匿名占位、未设置ID文本与不可上传状态，恢复96px容器、32px相机、13px handle与源间距；不要导入 Leo 照片冒充本人。 |
| P1 | A HTML:43、98、137：卡片12px圆角、12px内边，纵间隔16px；heading section17px/22px600 | `common.wxss:15`；A WXSS:23-24、56；WXML:5、20-21 | 当前圆角14px、内边12px、卡片底距11px，section标题13px700。卡片及section标题可恢复24rpx圆角、32rpx间隔、34rpx/44rpx600；不要把字段标签13px也统一放大为17px。 |
| P1 | A HTML:47-52：昵称标签13px/16px600，备注11px/14px700；昵称17px/22px600，输入py4px/px12px、8px圆角 | A WXSS:24-27；WXML:6 | 标签13px700、备注10px500；昵称13px，py9px/px11px；8px圆角已经接近。当前昵称文字小4px且输入内边使高度不同。保持“全局昵称暂未开放”、活动内昵称说明，按字段层级分别恢复字号/行高/内边。 |
| P2 | A HTML:56-80：字段组gap12px、gender padding4px/gap4px/按钮py6px、13px/16px；bio15px/21px、10px padding，3行textarea | A WXSS:43-49；WXML:16-17 | gender/bio前距14px、selector3.5px pad/gap、按钮12px；bio11.5px、最小71px。源bio textarea约3×24.375px+20px padding=93.1px（leading-relaxed=1.625），当前内容和说明并非 textarea，不能宣称精确高度匹配。恢复15px正文及源外框节奏；未开放态保持不可编辑，附说明允许增加高度。 |
| P2 | A HTML:84-94：城市icon32px、18px symbol；小字11px/14px、大字17px/22px600，row py8px | A WXSS:50-55；WXML:18 | 当前icon29px，城市主字13px700、小字10px、顶padding14.5px/无底padding。保持当前本机浏览城市，恢复源字号、32px图标与双向8px row padding；城市实际长文本允许换行，不裁掉“仅在本机用于浏览”。 |
| P2 | A HTML:109-132：chip13px/16px600，px12/py6px，gap8px，close14px | A WXSS:58-61；WXML:20 | 当前chip11px、px9.5/py4.5px、gap5×6px，缺关闭图形。可恢复chip尺寸和视觉图形，但关闭/添加不能做成可保存的假功能；需 disabled 语义或未开放说明。原“6个已选”不能恢复为真实已保存兴趣。 |
| P2 | A HTML:158-175：认证卡双列，各含28px圆形图标和两行13px/11px，卡内10px、gap4px、8px圆角 | A WXSS:67-68；WXML:21 | 当前各列只有一行文字+字符，内边7×4px、8.5px圆角，字10px。可恢复双列图标+两行结构（例如“羽毛球水平 / 未认证”）；不得恢复Lv.3或认证身份。 |

“设置本场昵称”按钮及弹层（A WXML:7-15、WXSS:28-42）是实际 R1 能力的必要新增，不是原稿缺陷；其默认可见占高不可从整体累计差值中当作纯视觉错误。未开放额外说明也会改变页面纵向坐标。本轮优先修正外围字号、几何和图形，不删实际入口来凑原 PNG 高度。

## PG10-B：勋章馆

| 优先级 | 原稿及源行 | 当前源码及源行 | 可修正差距（375px） |
| --- | --- | --- | --- |
| P1 | B HTML:24、28、30-35、42-48：summary16px radius/padding，orb80px/16pxradius、有4px内框与半透明内面，12px间距；title20px/26px700、description13px/18px、next11px/14px | B WXSS:16-25；WXML:4 | 当前summary13px pad/15.5pxradius；orb75px/15.5pxradius且无内框；间距11px；title14.5px800、description10.5px、next10px。摘要文字和容器显著缩小；可恢复32rpx pad/radius、160rpx orb、内部玻璃面以及40rpx标题，保持“尚未接入”“—”与无等级状态。 |
| P2 | B HTML:53-63：XP内卡12px radius/8px pad，row11px/14px，track10px高且2px inset | B WXSS:26-29；WXML:4 | 当前内卡12pxradius、8.5×10px pad，row10.5px；track6px高且无inset。可恢复20rpx轨道和4rpx内边，保留空轨道；86%填充、860/1000 XP及晋升距离无数据支持，不能恢复。 |
| P1 | B HTML:70、74、79、81-115：showcase12px pad/16px radius，heading17px/22px600；slot gap12px、pad8px、12px radius、icon40px | B WXSS:30-35；WXML:5 | 当前pad11.5px、radius15.5px、heading13.5px750；slot gap4.5px、pad5×2px、radius8.5px、icon26px。四空位应保留未佩戴状态，同时恢复40px空位图标、12px gap与slot尺寸。原三枚佩戴/check 不可恢复。 |
| P1 | B HTML:123-137、142、144-153：tab13px/16px600，px14/py6px；grid12px gap；cell16px radius/8px pad；icon48px内核/56px外框，标题15px/20px600、备注11px/14px700 | B WXSS:36-52；WXML:6-7 | 当前tab10.5px、px12.5；grid7.5px gap（列宽110px，源约106.33px），cell13.5pxradius、15px顶部padding/113px minheight；icon49px但没有56px光晕框；标题12px700、备注8.5px。Wave45增高并不等于字号/列距还原。恢复24rpx gap、32rpx radius、30rpx/40rpx标题、22rpx/28rpx备注和源icon外框；长“待开放”备注需可读处理，不能仅提高字号后继续单行截断。 |
| P2 | B HTML:225-248：locked两卡低灰底、75%opacity、无阴影、右上lock16px | B WXML:7；WXSS:41、50；JS:12-13 | 当前只将icon变灰，整卡仍白、有阴影，没有lock。可独立恢复这两张概念卡源灰底/弱化/锁图形；所有九枚仍明确“尚未授予”，不把其他彩色卡解读为当前账号已解锁。 |
| P1 | B HTML:288-292：底部16px水平边距，56px高、17px/22px600、24px celebration | B WXSS:55-58；WXML:9 | 当前15px边距、minheight45px、13.5px750、15.5px字符。保持概念分享实际open-type，恢复112rpx高、34rpx/44rpx文字及48rpx庆祝图形；源安全区能力保留，说明文字额外高度是诚实状态差异。 |
| P2 | B HTML:254-280：detail24px顶圆角、16px padding、80px icon、20px/26px title | B WXSS:60-77；WXML:11 | 当前顶圆角18px、16px横padding、51px icon、15.5pxtitle。可恢复48rpx顶圆角、160rpx图标、40rpx/52rpxtitle；原两列XP/Top统计和挂载按钮没有实际能力，保持概念说明/真实活动入口。 |

B JS:9 的“城市漫步家”与原 B HTML:199 的“滨江漫步家”是概念名称差距，可在不声称成就的前提下恢复原名称；类别差距也应注意：原漫步是 sports（192）、首局是 social（214），当前分别 explorer、organizer（JS:9、11）。这两项分类不是后端真实数据，属于可修正的概念内容对应关系。分类计数28/6/8/7/7与LV3/MAX/TOP/99+则代表授予/等级，不能无数据恢复。

## 保留的实际入口与状态

- “我的” `me.js:876-878`：编辑→`/subpackages/profile/profile-edit/profile-edit`，兴趣→同路由`?focus=interests`，勋章→`/subpackages/profile/badges/badges`；`me.wxml:5-6` 所有勋章按钮仍绑定 goBadges。两份 PG10 源不包含“我的”母页面，不能用 A/B 给母页面整体做1:1结论；这里只核对入口和父页待开放标注。父页 emoji 与馆页源symbol不一致可统一为同一图形资产。
- A `profile-edit.js:76-82`：候选本人活动→`/pages/event/event?id=<encoded>&section=registrationSection&entry=alias`；保留当前会话/成员授权。84城市→`/pages/city/city`；85个人→`/pages/me/me`；86-89活动空态→`/subpackages/profile/moments/moments?filter=all`并关闭选择层。91-97隐私/说明→现有privacy-safety/legal；99-101注销设置`profileFocus='privacySection'`再切我的。
- B `badges.js:39-61`：个人→我的、隐私→privacy-safety、活动→moments`?filter=all`；分类只筛概念卡、详情只说明尚未授予；64起分享仍仅概念页与明确未开放标题。没有实际分享投递证据。
- 头像、全局ID、昵称/签名/性别/兴趣保存、认证、勋章授予/XP/佩戴皆保持关闭态；浏览城市是本机数据；本人活动/活动昵称才是真实业务。原稿 Leo照片、30天剩余次数、认证身份、奖章数量和XP统计不属于应该照抄的视觉缺陷。

建议下一轮以页内专属样式恢复页壳、标题、符号、摘要和三列卡几何，再对同375px视口逐页截图；本审计不代替该复拍，也不改变现有验收矩阵的局部实点边界。
