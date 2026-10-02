# Wave 68 — PG04-S 羽毛球 PUBLISHED 原稿实施与冻结（2026-10-02）

## 范围

依已批准 `docs/superpowers/plans/2026-10-02-profile-four-and-published-reference-ui.md`，完整重读 `pg04_s/code.html`、查看545×1600完整PNG，并对照 [下一批只读审计](caper-next-host-checkin-aa-gap-audit-wave67-2026-10-02.md) 发布成功章节。只修改真实分包活动页 WXML／WXSS，新增15个本页准确 Material SVG及独占来源／实施证据。**作用域仅 `loadState==='READY' && successState==='PUBLISHED' && display.isBadminton`。** `event.js/event.json` 原字节保持。没有 PG06/08/09 同批实施，没有 Git mutation、微信 CLI／SDK／CUA、配置／global／总矩阵／全量测试或新增业务测试。

原 HTML 17310 B，SHA256 `168f4582264fad299c953bd377e915b38a81a2fb01001e5f5259195846f0361a`；PNG426748 B，SHA256 `0b216f3226ec3c1e0ef1c1034787f486e7a3f9013118c75bf9265feaaddbcf94`，与原ZIP两entry字节相同。ZIP及全部来源hash在[来源清单](../design-sources/caper-pg04s-wave68/source-manifest.json)。

## 恢复内容与真实语义

| 源区域／selector | 本次字面px／原字体 | 数据和真实动作 |
| --- | --- | --- |
| `.pg04s-native-nav` | fixed、真实statusBarHeight+56；横16、close触区44/负左4/icon22；title17/22/600/max200/tracking−.025em；蓝圆32/person18；blur24、原0 1 8/.03阴影 | `goBack`关闭结果；标题按APPROVED“活动发布成功”／其他“活动已提交审核”；person仍`jumpToSection(registrationSection)`；使用既有headerPaddingRight，限定title ellipsis适应胶囊；旧topbar在本scope不双显 |
| `.pg04s-hero` | pt8/pb20；224光层/top−24/blur64/z−10；64绿soft圆/check_circle36 FILL1；原bounce2.2s与浮emoji；badge11/14/700/p4×12、mb8；title22/28/700；copy13/21.125/max270/mt4 | 已审／待审不同文案；未把PENDING说成邀请或报名已开放。原固定“周六暴汗局”改用已有真实发布说明 |
| `.pg04s-event-card/.pg04s-cover` | r16/shadow-sm；cover176、原black80/20/transparent scrim；live tag11/14、circle6；source贴纸top12/right−8/rotate6/17/22/600；caption11/14/700、title20/26/700、fee11/14 | 复用原既有JPEG字节，不复制；visible/aria类型示意；状态、标题、费用、日期与地址真实bind。source MATCH READY 改当前资格的 INVITE READY／PAUSED／REVIEW PENDING；IRL SATURDAY GAME改IRL BADMINTON GAME，不伪造星期／成局 |
| `.pg04s-facts/.pg04s-roster-row` | p14/gap10，iconbox24/glyph16；date13/18/600，place13/18/400；rosterpt8、avatars28/overlap−8、实际nickname行11/14；minimumbadge11/14/600 | calendar_today与location_on源色；confirmed/max/min真实字段；现授权confirmedRoster至多2个字形／公开昵称仍保留，空名单是person_add装饰占位，不是假成员。badge为真实min“X人成局”，没有固定1人／差3／预订凭证 |
| `.pg04s-actions` | header17/22/600/group_add18；caption11/14/700；grid2/gap12/p14/r12；icon40/glyph24；label15/20/600、副文13/18；recommend10/21/700/p2×6 | 分享／海报／口令保留资格条件、openShareCard、data-poster/data-copy和原id；第四格保留真实hostSection管理。原推荐只在canCopyPublishedInvite时显示，不假造常聚5名球友／自动邀请 |
| `.pg04s-helper` | p14/r12/gap12/原F0F4FF→FAF5FF渐变；紫圆32/auto_awesome18white/shadow-md violet25；heading13/16/700、caption11/14/600；正文13/17.875 | 保留“受控建议”和本地助手只提供草稿建议／自动邀约与AI群聊尚未开放；原假“自动托管中”不接入 |
| `.pg04s-ctas` | 纵gap10；两button48/rfull/15/20/600；primary原蓝及shadow-lg blue25/arrow20，secondaryvisibility20 | `jumpToSection(hostSection)`进入真实工作台；`viewSuccessDetails`返回同活动详情 |

整页真实viewport100%、body source min884与100vh适配、inner横16、底40+native safe area。原 px不整体转rpx或缩字体。长真实title限定两行、fee/context限定ellipsis，保留源几何而防止超出；原fixed页面代号不放入用户标题。源照片被标为示意，额外caption9/11属于R1真实性补充，非原source token。授权nickname扩展与真实资格说明也属于保留的R1字段，未声称与静态示例文本等长。

“推荐”span原 `font-label-sm text-[10px] font-bold` **没有** `text-label-sm`或leading utility：10px任意字号继承body `text-body-md` 的21px行高；首次草稿写15px，读源后仅将该声明修正21px，见[单项来源修正](../design-sources/caper-pg04s-wave68/recommend-source-correction.json)。没有重复已通过的绑定／字形／全部源校对。

## Material准确来源

本页完整原HTML无inline SVG；15个Material节点的symbol、显示px、颜色与唯一FILL1见[Material manifest](../design-sources/caper-pg04s-wave68/material-manifest.json)。原第二Material同family/style/100..700声明覆盖第一，官方Chrome请求原WOFF2 fvar仅 FILL与wght，没有opsz/GRAD变量；默认wght400，固定opsz24/GRAD0。源 `.material-symbols-outlined` font-weight normal，所有本页span没有显式bold，所以**close22是400，不用600 arrow back**。唯一source check_circle明确FILL1；不换成普通check或FILL0。

固定官方请求TTF Version2.972，FontTools4.60.2只做 `(1,0,0,-1,0,0)` SVG坐标翻转，没有重新画轮廓。限定检查逐个比较固定导出path与原第二variable face 400/FILL0或1实例，15个均相同；每个unicode/GSUB/颜色/path/原字体与CSS hash保留docs。首次WOFF2直接读失败缺Brotli；Node内建zlib reader bridge解决，未安装包／改共享helper。这次source准备失败不是产品测试失败，并在来源清单保留。Apache-2.0原文／hash指向既有许可；没有字体二进制进小程序，也没有新图标库或全局font修改。

## 原业务和未改区域保护

新增header与content都使用上述完整guard。旧PUBLISHED块只追加该guard反条件，generic整段保持；外层只新增scope class，旧topbar只追加该guard反条件。逆向删除两个有标记新增块、还原这三处scope接点后，WXML**逐字节等于**baseline100072 B，SHA256 `c2dd55c68a3123d9969c204df0d1e91ccca69e53dda4ae5c921a12041eeb9720`。因此PG01、PG05、PG05-S、generic及其余registration/content/host/checkin/expense/cohost/safety等旧节点没有重写。新CSS仅追加，旧120006 B前缀SHA256 `94049293bebaf3889760403fb43de4b0a3710f82de40d3d0655e54ef5074e6af`逐字节保持；新selector／keyframes使用pg04s前缀，未改公共header／导航／anchor。

JS104047 B，SHA256 `ccb5b5fede066ba0533b82cb564e816cc3d45ca96778a0d25ac5286d3c11a4bd`；JSON69 B，SHA256 `bf33dc7da099d240642a50fe3cf44cee01a2b282f70a80a313c79317c76ad10b`，各与baseline原bytes一致。refresh、PUBLISHED同id/host/RECRUITING/审核条件、canCopyPublishedInvite的有效期／风险／招募条件、openShareCard再刷identity/event与share/poster/copy参数资格、真实成员计数／授权昵称、旧分享URL与分包入口均不改。源copy按钮只假改字，不作为真实clipboard实现；本批继续进入既有邀请卡核资格，未发消息或造分享投递成功。

## 一次限定检查与结果边界

执行 `/private/tmp/caper-wave68-published/check-published-source.py`，退出0；[完整结果](caper-pg04s-limited-check-wave68-2026-10-02.json)：

- 原HTML/PNG两ZIP entry字节相同。
- 15 SVG XML/viewBox/颜色/path/hash逐项有效，且全部等于原第二字体400/FILL0或1实例的glyph轮廓。
- WXML仅按合法wx命名空间／裸wx:else／属性XML转义作读取规范化后解析通过，未修改产品以适配验证器。
- 当前185绑定（baseline177，新增8）处理函数均存在，missing0；55个独立静态src引用均存在，missing0。
- WXML逆向还原、旧CSS前缀、JS／JSON全字节保护，以及既有JPEG63131 B/hash均相同。
- 产品源净增31968 B：WXML+7857、WXSS+11945、15 SVG+12166。该数是raw源字节，不代替root编译包体。

单项recommend修正只核原继承21px与CSS前缀保持，退出0；没有重跑完整source检查。没有编写镜像布局测试、全量业务／CI、调用微信或SDK。尚未有本批模拟器、真实分享／日历／clipboard、真机、线上API验收；root负责限定当前PUBLISHED已审/待审、同id按钮目标和实际包体验证。

## 冻结与交接

完整owned路径／字节／SHA及净增在 `/private/tmp/caper-wave68-published/frozen-paths-wave68-published.json`。root独立review可按 `.pg04s-native-nav/.pg04s-content/.pg04s-cover/.pg04s-actions/.pg04s-helper/.pg04s-ctas` 定位，只读检查新scope和来源。冻结后event产品文件保持不动；若发现具体来源偏差，仅按对应声明最小修正并重冻，不扩大PG06/08/09或重复全部检查。

## 最终成功图标：原 PNG / HTML 冲突订正

根在完整原PNG与本批实际截图对照中发现，给定PNG成功mark是绿色描边圆圈和绿色tick；HTML:17却显式FILL1，按HTML导出的初版为绿色实心圆和白tick。用户要求1:1视觉复刻，根明确授权此节点以PNG外观为准。本代理重新打开完整源PNG确认这一差异，随后仅导出同原官方后置face400/FILL0、固定opsz24/GRAD0、U+E86C `check_circle`；源颜色#34C759与显示36px保持。原HTML、FILL1来源及原856 B资产原字节保留为历史；其他14原图形、CSS/JS/JSON、布局和全部业务范围不改。

新资源 `miniprogram/subpackages/activity/event/assets/pg04s-check_circle_fill0.svg`：**856 B / SHA `a4b04b9903d61e6c90cf012bdba7c6a0bc8ebc35c4b1fea4b97284a0afb1ceb6`**。仍从已留存Version2.972 `original-second-decoded.ttf` 的准确实例直接读取轮廓，经Y翻转导出，无舍入或重新绘制。它没有重复下载字体或安装依赖。

WXML唯一差异是这一处 `pg04s-check_circle_fill1.svg` → `pg04s-check_circle_fill0.svg`：**107,929 B / 最终SHA `06741c8056566a32f33f356ce65f9aabfcb2164d950a6c288c28e2ec48f0fdf3`**。逆除这一次引用替换精确恢复初版WXML SHA `f2c53eb42c43608f3be3b9355902598bcee270bce446fe6f6390c36d22f13c80`。CSS / JS / JSON快照仍分别是此前36f4980f… / ccb5b5fe… / bf33dc7d…；不通过改业务或几何配合图标。

单项证明为 [success-mark-png-override.json](../design-sources/caper-pg04s-wave68/success-mark-png-override.json)，包括PNG/HTML身份、冲突优先级、原font hash、axis/path、当前资源及唯一src逆除证明。初始185bindings /55refs /源ZIP检查保留原时刻，不重跑或改称这次已验。根随后只拍此mark并做最终实际编译包值；本代理没有SDK或运行验收声明。

本次新增运行SVG856 B，WXML字节数不变，最终产品raw净增 **32,824 B**，原FILL1保留在内的16 SVG共13,022 B。最新owned freeze清单由同路径重新写出，最终source correction已加入；产品再次冻结等待根定点截图与整合。
