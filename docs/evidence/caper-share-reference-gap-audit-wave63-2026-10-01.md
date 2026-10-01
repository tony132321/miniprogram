# 活动邀请卡原稿差距审计（Wave 63，2026-10-01）

本报告为独立只读审计。已完整读取 `_3/code.html`（编号至185行，末行没有换行）、查看 `_3/screen.png`，并完整核对当前 `share.wxml`、`share.wxss`、`share.js`、页面 JSON、全局样式、二维码绘制函数及相关既有证据。只新增本文件；未修改产品、Git 或模拟器，未运行任何业务测试或全量测试。原稿几何可以恢复，真实邀请码、资格、脱敏、过期和离页防护必须保留。二维码尺寸方案由根代理决定。

## 1. 来源与字节快照

原稿：`/private/tmp/irl-stitch-original/stitch_design_system_generator/_3/`。PNG 为 **570×1600** 的纵向导出图，图中像素距离不能直接当成375px设备的CSS距离。以下原尺寸来自HTML明确的Tailwind token；当前rpx按 **375px窗口，2rpx=1px** 换算。本轮没有取得新的微信运行时布局或截图。

| 文件 | SHA-256 |
|---|---|
| 原 `code.html` | `dc13ab1a0889aefa66090c208839573e24f925a6969bc220ca86bc0dd4a9622b` |
| 原 `screen.png` | `349d2b42e3da3c00e1654ad0ffcd37f6831dfc7b10e3969ad2b20b1641ec1779` |
| `miniprogram/subpackages/activity/share/share.wxml` | `757f9f3c73f4a043c0b3d610f73605a7320c928fa984ecfa35cad9c176c4fad4` |
| `miniprogram/subpackages/activity/share/share.wxss` | `9e331c83874761a2e98bed95b7137a6a3ecbe4a448c9ec2ce39e8cda2381041a` |
| `miniprogram/subpackages/activity/share/share.js` | `bad617d7d7cc404374b76e67be390ee7e590ee42c9999f02500096eef8a28d92` |
| `miniprogram/vendor/qrcode.js` | `79ec86f82856005b1c887905cfccfcfbec3821ca61c7fd5a952faa5f778f791c` |
| `test/miniprogram-caper-share.test.ts` | `77f28d5ebd63150bca6319c2fb19d49f65f0dba1fcef42ab19c42cd6ec2cf024` |
| `test/miniprogram-caper-poster.test.ts` | `b8ecbf4caf21b9cab5ceed77eab04f0fb6d136bdff0edeb32ae2704fb508040d` |

目标路由仍为 `/subpackages/activity/share/share?id=<eventId>`，自定义导航仍须让出微信原生胶囊。当前 `headerPaddingRight()`（JS:111–119）按胶囊边界计算，不能照原网页右侧个人头像位置覆盖胶囊。原图的头像、羽毛球标题、日期、场馆、人数和口令均为静态示例。

## 2. 精确几何差距

原稿主要字体token：headline-sm **17/22px，600**；headline-md **20/26px，700**；headline-lg-mobile **22/28px，700**；label-sm **11/14px，700**；label-md **13/16px，600**；label-lg **15/20px，600**；body-sm **13/18px，400**。当前页面没有加载原Plus Jakarta Sans字体，不能仅靠尺寸调整声称字体逐像素等同。

| 原HTML行／位置 | 原稿尺寸、颜色、结构 | 当前源码／375px换算 | 建议恢复与边界 |
|---|---|---|---|
| 10 顶栏 | 高56px；左右16px；返回44×44px触区、22px图形；标题17/22px；个人圆32px、18px人像，底 `primary #004cc8` | WXSS:4–7 高至少46px；左14px；返回宽24px、字符27px；标题14px/800；头像23.5px、字符14px，底 `#1d64f2` | 原触区、字阶与颜色可以恢复；状态栏和胶囊避让按当前真实客户端保持，返回／我的绑定保持。 |
| 10 页面水平边距与分组 | 内容左右16px；外层纵向gap16px，底32px | `.share-content`左右14px、顶6px、底27.5px；各子块单独margin | 外层边距32rpx；按原组间16px组织，不能用固定内容高度截断长活动名／真实说明。 |
| 12–18 引导 | 顶8px；内部gap4px；pill横12、纵4px，底 `#F3FEE7`、字 `#3f4c00`，15px verified、文字11px；主标题22/28px；说明13/18px | pill横8/纵3.5px，底 `#f2fbdc`、字 `#43580a`、9px/800，缺图；主标题19px/900；说明10.5px，margin分散 | 恢复24/8rpx pill内边距、30rpx图形、22/13px字阶；仍使用当前 `canShare`、`shareReason` 和真实邀请提示。 |
| 21–23 外券和彩条 | 白底、16px圆角（rounded-2xl）、shadow-xl、overflow-hidden；彩条 **8px**，蓝 `#1D64F2`→青柠 `#D2F803`→紫 `#5856D6` | `.ticket`圆角14px、当前显式shadow；彩条 **5px**（10rpx） | 圆角32rpx；彩条16rpx。保留父级overflow-hidden用于两侧圆缺口。 |
| 25–30 券头 | 横16、上16、下8px；底 `#f4f3f8`；sports_tennis20px；文字11/14px、色 `#424655`；绿色点10px | kicker横12.5/纵12px，底 `#f0eff6`、文字9.5px/800、色 `#394152`；图形为 `✦`；点8.5px | 恢复32rpx横、32/16rpx上下、40rpx官方图；源OFFICIAL字样不要求覆盖当前真实EVENT INVITATION文案。 |
| 33–40 券正文和标题 | 正文16px padding、纵gap12px；活动标题 **20/26px**，700；标题行gap8px；右侧青柠贴纸横10、纵4px、圆角8px、旋转1° | 正文13.5/13/9px；标题 **15.5px**（31rpx）、900；gap6.5px；右侧是动态绿色状态pill | 主体32rpx padding、40/52rpx标题与16rpx行gap；状态继续取 `display.status`。可复用源贴纸的青柠几何显示真实状态，不恢复固定LET’S PLAY保证。长名允许自然增高。 |
| 42–50 人数／主办capsule | 两pill gap8px，可wrap；每pill横10、纵4px、内部gap6px；文字13/16px；绿色点6px；account_circle16px | 当前没有主办capsule；已确认／最低成局事实在 `.ticket-count`，为9px文字、gap11px | 可以把已存在的真实确认人数／最低成局事实置于原capsule层级；不算造“差2人”、不编造Luna。若不新增主办数据，account_circle原slot留缺并在实现证据记录，不能由匿名人物替代真实主办事实。 |
| 53–73 时间地点事实盒 | **padding14px**，圆角12px，底 **#F5F6F8**；纵gap10px；行gap10px；图盒 **28×28px**、圆角8px；图形18px；标签11/14px；主值 **15/20px**、600；分隔线1px `rgba(60,60,67,.08)` | `.ticket-facts`横padding9.5px、纵0、圆角10px、底 `#f4f5f8`；行gap8px、最小46.5px；图盒 **21px**、圆角6px、字符14.5px；标签8.5px；主值 **10.5px**/700；线 `.5px #e1e5ec` | 恢复28rpx padding、24rpx圆角、20rpx间距、56rpx图盒、36rpx图形、22/30rpx字阶。地点继续只显示城市与详情核对说明（JS:246–250），不能填入源静安具体场地。 |
| 76–80 券缺口与撕线 | 分隔器相对定位、纵padding4px；左右 **28px圆**（w-7），位置 **left/right -14px**（-3.5）；背景 `#faf8fe`；撕线左右margin20px、2px虚线、`outline-variant #c3c6d8`40% | 当前 `.ticket-divider`只高1px、左右12.5px margin、1px虚线 `#e4e5ec`；**没有两圆** | 用56rpx圆、左右-28rpx偏移；分隔器撑开完整高度并垂直居中，不让圆跟着margin移动。虚线4rpx、左右40rpx。两圆和线仅装饰，无点击。 |
| 82–85 二维码区 | padding16px、子项gap12px；白框 **padding12px／圆角16px**、shadow-md；内SVG **160×160px**；总白框 **184×184px** | `.ticket-invite`上14/横12/下15px；canvas内联 **200×200px**，其上padding5px（10rpx）、圆角10px；现框布局约210px（需运行时核实） | 必须按下节同步选择码面与绘制；先把padding和shadow从canvas移到独立白框，画布本体无padding／圆角裁切。 |
| 134 码下说明 | 13/18px、400、色 `#424655`，距上一个块gap12px | `.invite-label`10px/750，margin7.5px、色 `#455066` | 恢复26/36rpx字阶与24rpx块gap；保留“扫码或输入真实邀请码”，不声称canvas可长按识别／即刻保证加入。 |
| 136–139 邀请口令pill | **整宽**、**padding12px**、**radius12px**、底 **#efedf3**、gap8px；key **18px #5856D6**；文字13/16px、600、色 `#1a1b1f`，可选择 | 当前仅裸 `.invite-code`，max-width100%、13px/900、margin3.5px、字距.5px，有overflow-wrap:anywhere；**缺灰底、整宽容器、key** | 外盒 `width:100%;box-sizing:border-box;padding:24rpx;border-radius:24rpx;gap:16rpx;background:#efedf3`；key布局36rpx；完整32位码可换行，保留现有复制动作。不要把原静态短口令照搬为业务值。 |
| 143–146 说明分组标题 | 组gap8px、顶4px；标题左右4px、11/14px、700、outline `#737687` | `.info-heading`margin上15.5/横1.5/下6px，10px/800、色 `#6d7788` | 维持原组间gap与小标题字号；继续标题“邀请前请核对”，不恢复虚构“专属特权”。 |
| 148–176 三说明卡 | **padding14px**、radius12px、横gap12px、组gap8px；图盒 **36px圆**，glyph **20px**；标题 **17/22px，600**；副说明 **13/18px，400**；白底shadow-sm | 每卡padding **10px**、radius11px、gap8px、margin-top5.5px；图盒 **29px**（58rpx）、字符14.5px；标题 **12px**（24rpx）/850；副说明9px、margin2.5px | 卡padding28rpx、圆24rpx、gap24rpx、图盒72rpx、glyph40rpx、标题34/44rpx、副说明26/36rpx。真实当前说明较长，文字容器 `min-width:0;flex:1`，卡高度随正文增长，禁止固定高度／单行裁切。 |
| 179–183 源底部通知 | 居中；上margin4px；pill横16、纵8px，圆角full、底 `#e9e7ed`；camera16px蓝；11/14px文字 | 当前为真实分享CTA、反馈与英文footer，源通知不存在 | 分享CTA／反馈继续可达。若恢复静态通知外观，文案应说明“在分享选项生成并预览海报”，不能在尚未生成时声称“已生成高清邀请卡”或“截图即发送完成”。 |

## 3. 页内准确官方图标清单

原稿均为 **Material Symbols Outlined**。F0表示该span没有显式设置FILL，F1表示原span明确 `font-variation-settings: 'FILL' 1`。尺寸是CSS图形框字号，不是SVG path的黑色像素包围盒。原网页实际最终字体轴没有在本轮测量；既有导出管线固定Outlined wght400／GRAD0／opsz24，不能因此声称所有字体轴与Web Font逐像素一致。

| 原HTML行 | 精确原名 | FILL／px／源色token→色值 | 当前slot与恢复边界 |
|---|---|---|---|
| 10 | `arrow_back_ios_new` | F0／22／on-surface→`#1a1b1f` | `.header-back`字符 `‹`；保留 `bindtap="back"` 与返回fallback。 |
| 10 | `person` | F0／18／on-primary→`#ffffff` | `.header-profile`字符 `♙`；保留 `bindtap="goProfile"`。 |
| 14 | `verified` | F0／15／on-tertiary-fixed-variant→`#3f4c00` | intro-pill缺图；仅与真实当前邀请已就绪状态并置，不使用F1源版本代替。 |
| 27 | `sports_tennis` | **F1**／20／electric-blue→`#1D64F2` | kicker `✦`；必须精确sports_tennis填充版，不用emoji或手画拍子。装饰图不能改变实际活动类型数据。 |
| 48 | `account_circle` | F0／16／electric-blue→`#1D64F2` | 当前没有源主办capsule及主办display字段。图形取得与数据补槽是不同决定；不能造Luna姓名。 |
| 56 | `calendar_today` | F0／18／electric-blue→`#1D64F2` | 第1 `.fact-icon`字符 `▣`；不要换成event／date_range。 |
| 66 | `location_on` | F0／18／party-violet→`#5856D6` | `.fact-icon.location`字符 `⌖`；保持城市与脱敏核对文本。 |
| 137 | `key` | F0／18／party-violet→`#5856D6` | 整宽口令区缺图。图形 `flex:none`，文本允许多行。 |
| 150 | `bolt` | **F1**／20／on-tertiary-fixed-variant→`#3f4c00` | 第1 `.info-icon`当前 `✓`；浅底 `#F3FEE7`；保留“以活动当前状态为准”真实说明。 |
| 160 | `groups_2` | **F1**／20／electric-blue→`#1D64F2` | 第2 `.info-icon.blue`当前 `♙`；浅底 `#EBF2FE`。必须groups_2，不能用group／groups。 |
| 170 | `receipt_long` | **F1**／20／party-violet→`#5856D6` | 第3 `.info-icon.violet`当前 `▤`；浅底 `#F2F1FD`；保留真实费用／取消规则说明。 |
| 181 | `photo_camera` | F0／16／electric-blue→`#1D64F2` | 源底部通知slot；若增加真实海报说明，使用准确photo_camera，不用photo_camera_front。 |

资源建议放本页独占 `share/assets/` 与 `material-symbols-sources.json`，引用本分包绝对小程序路径，避免跨个人分包引用。已有源导出helper为 `/private/tmp/irl-material-symbols-wave60/export_symbol.py`，已读取脚本和 `upstream-commit.txt`，固定commit为 `bd8cb85bd4bad964fe6918f79665bb40c3a8efef`。它只改SVG根fill，保留准确名称/FILL官方路径，在manifest记录sourceURL与源／资源SHA-256；授权文档已有 `docs/licenses/material-symbols-Apache-2.0.txt`。

本轮只检查缓存，没有下载或导出。本地精确cache已存在 arrow_back_ios_new、person、sports_tennis(F1)、location_on、bolt(F1)、photo_camera；**verified(F0)、account_circle、calendar_today、key、groups_2(F1)、receipt_long(F1)尚未缓存**。未缓存不能推断上游缺失／404。若固定提交的精确原名确实没有SVG，再取得该原连字的官方静态字体子集，独立记录CSS／字体来源、hash、GSUB glyph映射、版本与轴，不改成近义glyph。`verified_fill1`虽然已有cache，不能替代此稿的verified F0。

## 4. 真实二维码：200px与160px的安全取舍

当前 `paintInviteQr()`（JS:5–19）对真实服务端inviteToken编码，纠错等级M，`unit=size/(count+8)`，黑模块坐标从 `(x+4,y+4)` 开始，先填满白色size正方形。也就是始终保留四模块的逻辑quiet zone。页内 `drawInviteQr()`（JS:20–23）传 **200**，WXML:17内联画布也是 **200×200px**。海报另在JS:46传200，位于360×600px离屏画布；页面UI尺寸调整不需要改变海报。

原HTML:85–133是人为拼接的装饰SVG，并有40px蓝IRL中央覆盖块，未编码任何实际邀请。**禁止把该SVG、蓝色定位中心或IRL覆盖贴进真实二维码，也禁止裁切／遮盖模块或白色quiet zone。** 准确码面比例、黑白真实QR和原装饰码的逐像素外观无法同时成立。

一次只读密度计算使用项目现有vendor和合成32位hex口令 `0123456789abcdef0123456789abcdef`（没有业务私码），取得M级 **29×29模块**，含quiet zone共37模块。200px时每模块约5.405px、每边名义白区约21.622px；160px时每模块约4.324px、每边名义白区约17.297px。该计算只确认此输入的网格密度，未做解码、扫码或真机验证；其他输入不应硬编码模块数。当前floor/ceil光栅算法保持不变。

| 方案 | 具体尺寸 | 能保证的内容与必要限制 |
|---|---|---|
| **保守纯布局方案** | 原画布 **200×200px** 保持；新增独立白框padding12px／圆角16px，框外184目标改为 **224×224px** | 不改JS、二维码坐标、模块和四模块quiet逻辑；能恢复原外框的padding／圆角／阴影，不能声称已恢复160px码面／184px总框。 |
| **根代理可选精确UI方案** | 仅页内绘制参数改 **160**，WXML内联尺寸同步 **160×160px**；独立外框padding12px，总 **184×184px** | 继续由同一真实token、M级、`count+8`与四模块算法绘制；`paintInviteQr`算法和海报200保持。这是范围很小的JS变化，但需要本批定向验证，不能直接用CSS视觉相似作为解码成功证据。 |
| **不接受的尺寸覆盖** | 仅写 `.invite-qr {width:160px;height:160px}`，或强行 `!important`，而draw仍按200坐标 | 普通selector会被WXML内联200px覆盖；强制覆盖可能造成显示／绘图坐标不一致。不能依赖它自动缩放全部旧canvas内容，更不能用overflow-hidden框把右／下40px隐藏。 |
| **未经验证的transform方案** | 对200画布 `transform:scale(.8)` 并调整外容器 | 源码层面无法证明微信旧canvas在实际客户端按预期缩放、布局、栅格完整性及扫码质量；transform保留原200布局盒也会改变间距。不得把此方案作为已安全恢复160px的结论。 |

若根代理选择160方案，既有 `test/miniprogram-caper-share.test.ts:173`对白底 `[0,0,200,200]` 的断言要按页内160同步，海报仍保持200。该测试使用二维码stub，验证真实token传递和白底绘制边界，**不能单独证明真实码已解码**。本轮不重复Wave 51业务门禁或既有真实二维码验证；只在实际尺寸变化后补必要的160px绘图解码／当前页实测，确认完整32位token与四模块留白，再报告客户端范围。根代理决定是否需要这一JS变更。

## 5. 32位邀请码与复制绑定

真实display.inviteToken来自当前服务端event，原因非空时为空（JS:250／254）；复制前 `copyInvite()` 会重新加载资格，复制当前event.inviteToken和使用说明（JS:444–500）。当前页面有三处 `bindtap="copyInvite"`：主券 `.invite-copy`（WXML:17）、分享弹层复制动作（38）、弹层口令“复制文案”（40）。恢复灰底口令pill必须保留这些绑定和可达按钮，不能改为复制源 `#周六羽毛球-IRL88219#`。

建议灰底pill内图标为固定18px，文本容器 `flex:1;min-width:0;white-space:normal;overflow-wrap:anywhere;word-break:break-all`；外盒width100%与border-box。静态“专属邀请码”标签和动态32位token可以拆成文本节点，但token字节不分段、不插空格、不缩略；可在展示层选择完整文本。当前 `.invite-code`已有overflow-wrap:anywhere，不能在恢复源码时用源静态短口令的单行布局覆盖它。

分享弹层 `.sheet-code`的现样式是单行ellipsis（WXSS:40），如本批顺手取消其截断，应只调整文字容器可换行和min-width；右侧复制按钮 `flex:none`保留，不占用或重画弹层4枚已完成SVG。主券与弹层复制最终都使用同一实际绑定，而非从可见文本读截断结果。

## 6. 已有业务事实与本批范围

源码本轮确认以下边界存在，本报告没有重写或重新测试它们：

- 只有当前主办身份可显示邀请卡（JS:224–233）；审核、招募、riskPaused、系统安全状态、服务端剩余有效期和报名截止时间共同决定canShare（JS:120–142／238–260）。
- 地点只公开城市与活动详情核对说明；真实标题、活动状态、已确认／最低成局人数仍动态派生（JS:242–250）。
- `onHide/onUnload`清除邀请码、来源、弹层与准备状态，递增页面／请求版本（JS:191–206）；账号切换清空旧邀请（278–288）；截止时间到达自动收口（290–323）。
- 准备分享与复制保留版本、身份、页面可见性和资格检查（JS:413–500）；原生分享要有服务端share-intent来源且仍可分享（506–515）；海报在生成后再核对资格（332–411）。
- Wave 51已有 `caper-share-page-unload-race-wave51-2026-10-01.md` 与 `caper-invite-server-expiry-wave51-2026-10-01.md` 定向证据，报告的旧通过数属于既有证据，不能计为本轮重跑。

源“免审核极速加入”“满4人自动成局且已订3号馆”“无商业溢价”“已为您生成高清卡”没有当前服务端事实支撑。继续保留当前三张事实核对卡与真实海报／分享操作，只恢复可复用的原卡片几何和准确glyph。源主办Luna、差2人、专属短口令同样不能覆盖现有动态事实。

弹层4个已完成资源保持原样，审计时散列为：chat `9df8ad78893b44de1bf5c64bd90faf3c3fce64631091e5167119a2d358e8abe1`；copy `1047a97a68f9bbf5ebec3e064a57662c7a60a9ddf01eee73dcfca001aee1e9e9`；group `278a87bf96cc9c8e2613986978fb7f84df196a7b518b3306ac9fd329655cb8c0`；poster `0868b6d957d133baa5d12a9c1871f18496d079c86b95477c3d750addbcef4bec`。本轮没有重做这些资源。

## 7. 整合验收建议与证据边界

实现前先核对本报告share三文件散列，防止并发漂移。最小实现范围为本页WXML／WXSS、新页内官方SVG与manifest；若选择184px总QR框，单独记录页内draw尺寸的JS变化并保留海报尺寸。圆缺口、彩条、标题、事实盒、口令pill与说明卡按上述明确参数检查，禁止通过缩小正文或隐藏事实凑原截图总高。

必要检查包括本地SVG解析和准确原名／FILL／色值／source与asset hash、所有本地引用存在、375px胶囊避让、长标题与32位邀请码换行、卡片副说明完整显示、复制和打开分享弹层实点、不可分享态没有私码。只针对本批实际变化做所需验证；无需全量测试、无需重跑Wave 51已有资格与离页矩阵。二维码如改尺寸，单列真实解码及客户端显示证据。

**本报告仅证明原稿读取、源码差距、字节快照与尺寸风险分析。** 未编译、未操作微信模拟器、未生成新运行截图、未验证微信原生送达、未取得真机或正式HTTPS链路证据，不能将本审计记为页面已恢复、39屏逐像素等同或生产发布通过。
