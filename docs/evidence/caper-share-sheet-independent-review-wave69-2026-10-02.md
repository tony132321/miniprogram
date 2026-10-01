# PG06-S 分享弹层独立来源审查（Wave 69）

日期：2026-10-02。审查者：`ui65_font_audit`，未修改产品。阅读用户完整 `pg06_s/code.html`，实际查看 `screen.png`，读取 share WXML / WXSS、相关真实 JS、独立旧副本以及 root 的来源 / 实施记录。只做一次有意义的原稿 CSS / 资源 / 保护范围检查，发现后对七条修正作局部逆除；没有运行实现者的 checker、产品业务测试、SDK、CLI、Git或全量验收。

## 1. 审查范围与冻结

原 HTML 为25,536 B，SHA256 `ae332500609017a0a0d467d88b52ff0942e3b2824dc542e8f5bd65e5e18527c5`；PNG SHA256 `25784a100075b14dccb1f3e0b0a562df4ffc9f5ef90f5dacfa900138a4b848f0`。前景原 source 集中在第191行；此前完整 PG06 Dashboard 作为模糊背景存在于用户稿，当前产品背景仍是原 `_3` 真实邀请页，审查没有将两者当作整个 PNG 相同。

初次读取的 root freeze 为18个 owned 路径，WXML 11,692 B / `94fcd4751620f77782db3852bb6be73668b3f82f73a8db1286c99ce0f2577fca`，WXSS 20,148 B / `a35b8d2ec709137ca2c67aab2ce6292686198db477b53e165dbdbb338d0db971`。源级联修正及新增 full-face证明后最终 freeze **20个路径**：`/private/tmp/caper-wave69-share-sheet/frozen-owned-paths.json`，3,555 B / `c1b1bf40c2d9173982a485d7b7862c815ccdc3935d2bdccd7c7a1030e880a5c0`。最终 WXSS **20,152 B / `3f69b34649e84e0b0354038fad2be585423e7c5b33e2579f6d8bdf727c78d743`**。WXML、八 SVG、原 JPEG 和 JS / JSON保持；新增元数据不需要再跑完整保护检查。

root 来源：[source.json](../design-sources/caper-share-sheet-wave69/source.json)、[protected-proof.json](../design-sources/caper-share-sheet-wave69/protected-proof.json)、[七规则修正](../design-sources/caper-share-sheet-wave69/cascade-correction.json)、[full / subset 八轮廓比较](../design-sources/caper-share-sheet-wave69/full-face-eight-outline-comparison.json)。实现说明：[root 分享弹层报告](caper-share-sheet-reference-ui-wave69-2026-10-02.md)。本审查的独立观察及比对在 `/private/tmp/caper-wave69-share-independent/`。

## 2. 发现并修正的来源问题

明确发现一类真实源码偏差：`font-label-sm` / `font-body-sm` 是 font-family token，不能把它当 `text-label-sm` / `text-body-sm` 的字号、行高及字距 token。原body为15px / 21px；以下 source 节点使用 family + `text-[Npx]`，所以继承21px line-height。原动态 CDN 被已有准确 Tailwind CDN 3.4.17文件替代作本地观察；Chrome154.0.8037.93只读 original HTML / CSS，所有 font / image 二进制网络请求均阻断。没有加载小程序、真实用户或产品 runtime。这份 CSS-only观察不证明原截图历史字形加载。

| 原 source 节点 | 确切原 computed style / 级联 | 初始产品偏差 | root 最终局部修正 |
| --- | --- | --- | --- |
| 招募 status | arbitrary10px / 700，line21，字距normal | line14 / .22px | WXSS107：line21 / normal |
| 日期 | `font-body-sm text-[12px]`，arbitrary12规则仅字号，继承body21；400 | line18 | WXSS109：line21 |
| 进度数字 | arbitrary11px /700，line21，normal | line14 / .22px | WXSS112：line21 / normal |
| 四列操作的按钮 / 标签 | button继承15/21；标签arbitrary12px /500，line21，normal | button / 标签line18 | WXSS118–119：line21 |
| 推荐 | arbitrary9px /700，line21；`tracking-tight=-.025em`→-.225px；未定义`py-0.2`，实际Y padding0 | line14 / -.45px | WXSS120：line21 / -.225px；原padding0保持 |
| 口令首行 | arbitrary11px /500，line21，normal | line14 / .22px | WXSS132：line21 / normal |

原“复制文案”按钮确实有 `text-label-sm`，所以11px /14px /600 / .22px是正确来源；WXSS134保持，没有跟着错误扩到21px。主标题17px /22px /700 /−.17px，副文13px /18px /400，邀请标题15px /20px /700，口令值13px /16px /700，取消15px /20px /700均与原尺寸token和后置weight对应。

最终仅七条新规则变化。独立按 [correction.json](../design-sources/caper-share-sheet-wave69/cascade-correction.json) 七条 new→old各唯一替换，严格逆除得到20,148 B /原 `a35b8d2e…` 整份 CSS；其它旧范围未扩大修改。证明 `/private/tmp/caper-wave69-share-independent/seven-rule-correction-delta.json`。没有重跑整套 checker 或原观察。

## 3. 原前景几何与颜色

| 区域 | 核到的来源对应 | 产品位置 |
| --- | --- | --- |
| 遮罩 / shell | black40%、backdrop4px、z50；top圆角28、max90vh、white、16px主padding / gap16、1px white60% top边框、shadow2xl | WXML61，WXSS89–91；原 `_3` header / native status保留 |
| 把手 / head | 40×6、outline-variant60%、top−4 / bottom4；title17/22、spark18、subtitle13/18；关闭32圆形 / close20 / surface-container `#efedf3` | WXML62–63，WXSS92–99 |
| 邀请 preview | p14 / gap14 /r16、electric-blue-soft→white→lime-tint向右渐变、divider8%边框、shadow-sm；64×64 /r12图、black20% /24px球拍层 | WXML64，WXSS100–116；真实标题、日期、状态及有真实数值时的容量 |
| 四列操作 | grid4 / gap8 / top4；单格p8 / gap6 /r16；图形48×48 /r16；chat、photo_library、groups26，content_copy24 | WXML65–69，WXSS117–127；`w-13 / h-13`未定义，不臆造52px；实际w12 /h12=48 |
| 操作颜色 | WeChat `#07C160`；photo orange→pink向右上45deg；groups primary `#004cc8`；copy `#e9e7ed`；推荐pink `#FF2D55` | 对应精确源 colors /direction，未换electric-blue |
| 口令 /取消 | cardp12 /r12 /gap8 / `#f4f3f8`；key20、copy_all14；copy px12 /py6 /gap4 /full圆角；取消py14 /r12 /top4 / `#efedf3` | WXML71 /74，WXSS128–138；真实邀请码替换原永久示例口令 |

图形容器、真实长标题的 flex /min-width约束、关闭能力字样、额外安全说明、“示意图”标签、反馈及safe-area的微信适配是当前真实产品范围；没有借来源检查把这些状态删掉以使整PNG更像。其背板、文案、原生胶囊及正式外部资源差异已在root报告明确，最终声明仅前景来源恢复和下述保护，不声明全屏像素完美一致。

## 4. 八个准确 glyph 与原 full face

初读八个 SVG 对应 root 保存官方 Material子集：最后同 family normal请求，woff2版本2.973 /v375，FILL轴0..1、wght100..700，default400；400/FILL0实例OS/2 weight400 /unitsPerEm960。每个 cmap、原 raw glyph outline、fill和源显示尺寸均独立比较。SVG保留 raw outline，`viewBox="0 0 960 960"` + `matrix(1 0 0 -1 0 960)`；未把字形重画或舍入。

审查者首次比较错误地在提取路径时先作Y翻转，而实际SVG已经以path transform正确翻转；初始八false是观察坐标约定错误。已保留初次结果，再仅更正这八项raw path比较，最终每条与实际SVG以及source.json同字节路径；不是产品修正或测试失败，也没重复prefix /binding检查。现有FontTools从既有本地路径复用，未安装依赖；bundled Python缺FontTools的单次导入尝试也没有触发安装。

本轮另出现 Activity700字形 full / subset差异，root因此要求只局部核本页八个400。复用 Activity已保存的原**未加 icon_names**最后同 family响应：v374 /Version2.972，fullwoff2 1,136,920 B / `77f9711f3f896a1d7a34ab95cffc45cfb17d84c223f197c1b90faa0d043006e9`；decodedTTF 3,200,992 B / `cf46fa438e9ce2265958fdea4498c31ae5b7b39cb172ebff4f6aedb5aedcbc90`。400/FILL0实例的DFLT /latn只有 `rlig`→lookup0(type7 extension→type4ligature)，FeatureVariations无，rclt无。按原span真实文本“close /calendar_today /chat /photo_library /groups /content_copy /key /copy_all”字符序列解析八个实际ligature，不以近似Unicode图形替代。

**八条原full raw轮廓与root现子集raw轮廓完全相同**；因此两响应版本不同但这八个实际400实例无需替换。证明14,100 B / `e45d885671aad3b7f15cf25d22e2a24ec3e9ae7516bf8ee53f40f94e347a4aef`，root已经原字节复制入docs。该结果不扩展为所有glyph、其它字重或其它页面版本相同。

| glyph | 源px | fill | 实际SVG Byte | SHA256 |
| --- | ---: | --- | ---: | --- |
| close | 20 | `#424655` | 228 | `d884d0ea25b61e6430f586f151db8694b42b8564b1ff849dd3bd81ffe2cbde91` |
| calendar_today | 13 | `#004cc8` | 603 | `30f0929bc2314fa840458dacc8b58d32dd496fcd77420d052982cb386540917d` |
| chat | 26 | white | 582 | `f19b9f2a869cba7c28e4f357b1048d5e3c09376020be9be9e11ff9bca8427839` |
| photo_library | 26 | white | 759 | `b89e7f62b727515229d427ba32b05ea76671fa7143671d0170c352f8c4789bc5` |
| groups | 26 | white | 1,464 | `45c7de3a5c8739d095544ca37637243e0500951900727a5140bbdf15bd82aa73` |
| content_copy | 24 | `#1a1b1f` | 724 | `13b7a99f8bc2a64391746104c6ae21e1c81f064f6383550d7b67096a8a2f006a` |
| key | 20 | `#004cc8` | 707 | `c23d475406c3e22fd21486d868e04c483bb7c7671b03cd5b9e3007121116da78` |
| copy_all | 14 | white | 865 | `a32590cccf58095b48849ed8455509c9d66f17c0866239a9606356332b3f0136` |

完整Apache许可复用已有 `docs/licenses/material-symbols-Apache-2.0.txt`。产品相对 `./assets/sheet69-*` SVG静态路径可从当前share页面解析且实际存在。新字形没有全局face或loader变更；Plus Jakarta四原字重继续复用，profile500alias未加到此页。未运行原生字形像素渲染验收。

## 5. 原JPEG与保护范围

原source191行64px图URL和source第8行活动背景URL相同；root正常TLS curl结果记录URL逐字一致，exit0。实际JPEG40,193 B，头`ffd8ff`，SHA256 `277b7d72221482111ee7799a958cd0c08ee7897fcb60f31900d1fcc68f293769` 与来源/freeze一致；审查没有重复网络获取、裁剪或重编码。当前仅旧真实类别cover classifier选择羽球时改用该原图，其他类别保留；“示意图”标记保持，不把场景图当真实照片。

| 保护项 | 独立结果 |
| --- | --- |
| `_3` WXML原prefix | 6,897 B，前后逐字节相同，SHA `1b4136ce41f430f3f9d47a6b288d54e1535369e057bf3103bd48e5ccc6a04451` |
| 旧CSS全文prefix | 13,329 B，前后逐字节相同，SHA `8309549f016b13b98e2496551089e88a069265c6d0b60b2ac8bb5a3b562f196c` |
| JS | 27,274 B，独立旧副本与现文件byte相同，SHA `5fdde14c88902bb18e4c045d81326974978d718c6181d94cf76c86f2177a8258` |
| JSON | 75 B，相同，SHA `95f4181c4eb25045c994138c56d0741f84443d00426599975f8a3fe4f24e4262` |
| 全事件binding顺序 | 14个完全相同：back、goProfile、refresh、back、copyInvite、openShareSheet、refresh、closeShareSheet×2、prepareShare、generatePoster、copyInvite×2、closeShareSheet |
| 原生share分支 | 2个保持，仅sourceToken成功准备后出现；没有新增假私聊或伪送达 |
| 初freeze18owned | 初读时逐路径bytes/hash全一致；最后只核七规则inverse及docs新增fullproof原字节，无完整重复检查 |

## 6. 功能及验收边界

分享弹层仍只有 `shareSheetOpen && canShare` 才显示。现有 openShareSheet / prepareShare / copyInvite / generatePoster / onShareAppMessage 保留真实活动、主办身份、加载owner、审核/招募/安全状态、当前版本、邀请码/截止有效期、page generation等守卫；没有静态 source数据覆盖实际活动。

复制两个入口均真实 copyInvite，不展示无资源的HTTPS链接。群聊准备前是关闭说明，准备后由原生选择分享，未增加直达固定微信群。海报仍由原JS真实canvas导出与再读活动/安全状态后previewImage，不把“生成海报”当相册保存或真实送达成功。progress只有实际confirmed与正人数上限时才显示，文本明确已确认 /上限，不硬填原6人 /差2人、75%或永久口令。原 source字样和背景差异已写清。

**结论：审查发现的字体family误当尺寸token已由root在七条新规则中修正，独立逆除确认为仅此范围。八glyph原full与subset准确轮廓、原JPEG来源、原邀请页前缀、JS /JSON及绑定保护已核。未留下需要产品整改的明确来源疑点；本报告不替代root定向CLI /SDK /实际点击，不声明完整原PNG、真机、正式订阅或生产验收通过。**
