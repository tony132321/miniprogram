# Wave66 消息 INBOX 独立来源与保护复核

日期：2026-10-02。review owner：`/root/ui65_font_audit`；与消息页实现 owner 不同。本报告为独立只读 source review；仅写本文件，未改消息产品或他人证据、总矩阵，未跑全量测试、CI、微信/SDK或Git写入。

## 结论与范围

**本批计划 A 的源码复核通过，未发现该范围内需要阻断后续原生验收的问题。**原稿 header／未读优先局部几何、两张精确 inline SVG、真实通知绑定及 CENTER／CHAT／长页保护边界成立。这个结论不代表消息全长页已经一比一，不代替 root 的微信实际 sticky、capsule、小屏、三筛选、搜索、CENTER 往返、设置、一条实际授权通知的点击、WXML编译或包预算。

本轮完整阅读的输入：

- 用户原 `caper_3/code.html` 全587行，32137 B，SHA256 `18fab22c6b92592673e19574739eb2ed86cbfb0fe628023ec5dcd3b843a1aa6b`；实际 viewport390px。
- 同目录原 PNG，290×1600，210560 B，SHA256 `85fc42cb05ea57b3afe81c594917572ead3122dfa5feb958595574fb5901da1b`，已查看整图。像素较窄来自长页缩图，本轮以明确HTML/CSS值核尺寸。
- 当前 `miniprogram/pages/messages/messages.wxml` 全104行、WXSS全325行、JS全514行。
- 实施计划 `docs/superpowers/plans/2026-10-02-messages-idea-visitor-reference-ui.md` 与 `docs/evidence/caper-messages-reference-ui-wave66-2026-10-02.md`。
- 通过只读 `git show d94d3aa:<path>` 获取该基线的上述3个完整文件；基线文件留独占tmp，只用于比较，不操作Git状态。

## 1. 有效原稿 px 与组件层级

| 原稿位置 | 独立核对结果 |
| --- | --- |
| HTML52–126 原 header | brand、title、filters确实同一header sticky。当前 WXML4–8新增一层 header 并完整包这三块；当前后置 `.messages-inbox .inbox-reference-header` 确实 sticky，top绑定实际status，horizontal20/bottom8；body原26rpx gutter由负margin抵消，viewport宽度保持，未给缩图写固定290px。 |
| 原 brand71–78 | 源logo32/white“耍”18/900、中文12/900/letter.1em、CAPER9/700/.05em与gap6，当前全对应。源shadow-md+blue500/30与当前两层blue30%阴影对应；不是新lime字标。 |
| 原 tools80–86 | 源两个32圆/gap8，SVG16，按钮背景slate100#f1f5f9与stroke父色slate700#334155；当前真实搜索/设置button绑定保留，资源未以Unicode/Material/Phosphor替代。 |
| 原 title90–110 | 24px/32/900/−.025em、count12/16/p2×8、副标题11/16.5/mt2；蓝贴纸11/700/p2×8/−3°、黄贴纸10/800/p4×8/3°/1.25，末行9px与原customshadow对应，当前Good/People/More Plans三行真实结构恢复。count继续真实unreadTotal，没带入静态3。 |
| 原 filters114–126 | font12/16/600、py6、gap8/mt16/pb4与当前对应。源inactive border slate200/80%保留，active无border与source蓝色阴影对应。三筛选仍ALL/ACTIVITY/SYSTEM；没有导入原活动筛选静态红点。 |
| 原 priority218–269 | 源cardp12/r16/border1/white；标题横4/mb8、rowpy8/px4/gap12、icon40、badge16、title12/18/time10/15/summary12/18和mt2，与当前后置规则对应。卡外横margin `calc(16px - 26rpx)`使最终sourceinset16，没改长页其他card布局。真实tone/icon仍按R1通知种类呈现，不复制Coco/阿杰头像、姓名或时间。 |

源 `py-0.2` 和 `shadow-2xs` 在此 Tailwind v3主题无定义，本批没有把它们猜成额外 padding 或新阴影。priority类别保留px4，vertical0，不伪称无效utility有尺寸。该节点的title/category/time仍保留真实文案、长内容ellipsis和现有可用宽限制；本报告只核本批明确定义的原尺寸，不把必要真数据布局适配说成静态原人物的像素等同。

## 2. 原生状态／胶囊与 sticky 边界

完整JS核：onLoad仍取statusBarHeight与原 `max(96, ceil(windowWidth-capsule.left+8))` 的capsuleInset；旧APIfallback24/96没有改。原网页9:41、信号、电量由微信提供，本批没复制假原生状态。

当前header有20px右padding，brand内联右padding=`calc(capsuleInset px - 20px)`，相加恰好为完整capsuleInset。因此控制区右缘=`windowWidth-capsuleInset`。正常helper中inset至少`windowWidth-capsule.left+8`，右缘不超过`capsule.left-8`；没有重复加20px而挤压品牌，也没覆盖胶囊。

实际statusshield位置固定z12，整header sticky z11；顶栏在statusBarHeight下，shield只在INBOX变白。brand从旧单独sticky恢复为relative，因此三筛选随整个header，而不是滚出后只剩品牌。**上述是源码及代数结论，未操纵微信或声称真实滚动/边界已看过。**fallback的实际设备位置、小屏和原生sticky还需要root验收。

`.messages-inbox`根类只在viewMode=INBOX存在；CENTER、CHAT_UNAVAILABLE根状态不含它。新39条selector全部先匹配该根，状态shield旧色与两种非INBOX布局不被新规则覆盖。

## 3. 原 SVG child 的逐字节来源核对

一次独立比较以原HTML对应aria-label的SVG为输入，直接比 raw child字节（不是只比序列化path或肉眼类似）：全部相同。应用资源仅两张，共965 B；每个WXML资源引用一次，assets目录只含这两张图。

| SVG | B | 应用SHA256 | 原／当前raw child相同SHA256 |
| --- | --- | --- | --- |
| `search.svg` | 207 | `aeff8942a1a5a1a87f6f8dadfccba80d47d758084cc333270b360caef617c302` | `2290cb772d8252c8f07c3bc1def3e48cbd95e8479a51e03044024d7eebf95603` |
| `settings.svg` | 758 | `2f20e16cc351312cb34aa489af483fac0aac754687a8044f214a1b784c54e8ec` | `a2ec2532f4b989db33be93fee45ee818dd7eec250fa17c311765d63967da0707` |

源search完整SVG SHA `a8f249f49b351dbf2fef218580f2b7d4edb99365d728f3d15f1b305efef14611`，settings完整SVG SHA `d8cec11b1177b094d3b96d0c0ec28e80f433870494c3b4a6202265348b25e181`。root规范化的仅xmlns、width/height24、网页class删除、原`viewbox`正确写`viewBox`，currentColor解析到原父色#334155。XML解析结果均为viewBox0 0 24 24/fillnone/stroke#334155/strokewidth2，子circle/path未新增、编辑或变换。

没有图标字体轴、字体下载或图片重复。来源为用户设计包inline SVG，未附单独许可；不推定其MIT或Material许可，也不把这两张user SVG记成第三方字体依赖。

## 4. 真实数据、绑定和受保护内容

独立取得的d94d3aa基线证明：

- JS30759 B和当前逐字节相同，SHA `799d2a61281dbb9ffceca63d2fe86a467201ef6de88543c40887ecfd1f2de1e3`。
- HTMLParser只抽业务属性节点，按真实markup顺序比较wx/bind/catch/data/id/disabled/value/placeholder/aria-label，共95节点，基线与当前相同。此处是95个属性节点，不能当95个事件或95次运行测试。
- 原CSS28676 B仍是当前逐字节前缀，SHA `d7f5eb1d60c43aba966ff87e2967af26ec6a87d5149435cfc953a4d8afb2b058`；新增39条规则全部限定INBOX局部header/priority目标，没有改CENTER/CHAT/长页业务样式。

| WXML保护区 | B | baseline/current相同SHA256 |
| --- | --- | --- |
| 搜索至priority前（错误/登录/加载/审核/空态/关闭会话/真实动作） | 4332 | `0503be16a19a0f047d0546e620b09765adf82cfcecbc2abe95d2db55e0670e07` |
| noticeGroups至CHAT前（加载更多/关闭AI与提及/gallery/slogan/settings/footer） | 4212 | `c3cc02f06246bbb61022c83bbdac044fed1099bde7c3f29b51cc93cb57e20129` |
| CHAT_UNAVAILABLE与CENTER到文件结尾 | 9854 | `2bd31b9efd56e6aca1928879e542eda10901ae94181aa4186c7a50d8453a7de2` |

独立读JS也确认：`refresh`请求真实`/me/notifications`，身份/generation/stale检查保持；`displayed`真实未读列表slice0,2为priorityItems，priorityCount由未读数得出，unreadTotal来自API或真实记录回退。notice点击仍校验当前id/eventId/kind后走真实event/profile再标记；审核、批量已读、地点复制身份/版本保护没有变化。没有引入原网页人物/私聊/历史会话/已发送消息、假未读或静态11:20。私聊、AI、提及、相册依旧明确未开放，原示意画面不被包装成真实照片或服务结果。

## 5. 一次比较、冻结与剩余验收

独立联合来源比较执行一次，exit0，`status: PASS`；涉及源hash、d94d3aa三文件、95节点、三保护区、39scope、两原SVGchild和实际资源965B。不运行接口、业务矩阵、全量、CI、SDK、微信工具，也不增加视觉镜像测试。

本机原输出：`/private/tmp/caper-wave66-messages-independent/independent-source-comparison.json`；同tmp有基线快照。只读对照的实际应用hash如下，均与实施freeze一致：

| 文件 | B | SHA256 |
| --- | --- | --- |
| `messages.wxml` | 21339 | `7b8e9bc25ee9175d68210517e9091377d0ca461df0a2e41541729f8aabdb9b9a` |
| `messages.wxss` | 33781 | `4473440860e25493bd4875a6515dce0b421e5a5a2fa06f36a8d2083e4541ad65` |
| `messages.js` | 30759 | `799d2a61281dbb9ffceca63d2fe86a467201ef6de88543c40887ecfd1f2de1e3` |

WXML+CSS+965B素材净增6378 B，由基线差值独立得出，和实施证据相符。最终本批编译主包<2MiB仍由root真实preview判断；本review不推定最终包体，也不替代同tree GitHub提交。

后续root有限走查仍包括：INBOX nativeheader/sticky/capsule、小屏三筛选/搜索开关、CENTER往返/设置、一条当前授权真实通知；保护状态只检查有具体风险的代表状态。本批长页其他模块仍原实现，39屏整体像素、正式外部资源、真机和真人活动验收边界保持。
