# Wave 68 后续消息原稿差距与按钮语义审计（只读，未实施）

日期：2026-10-02。审计者 `/root/ui64_review`。完整读完三份原 HTML 并查看三个完整 PNG；6 个来源文件与用户 ZIP 逐字节相等。读取当前完整 messages WXML/WXSS/JS、messages.json、app.wxss、R1 flags，并对照 `docs/stitch-ui-parity.md:216 / 217 / 221` 三行及 Wave 66 INBOX 证据。**本任务仅来源盘点，不改产品、配置、Git 或矩阵，不运行任何测试、CLI 或 SDK。**

## 1. 来源与当前快照

原 ZIP `/Users/tsb/Downloads/stitch_design_system_generator (2).zip`，24,668,856 B，SHA256 `df22e733d33fda20979b75b8a7bc94717c4a5c9e41561a54e3038432fab32603`。读的原目录 `/private/tmp/irl-stitch-original/stitch_design_system_generator/`。所有 HTML 均为 `width=device-width`；下列 PNG 长图分辨率不是 CSS viewport，尺寸须按 HTML class / config px 恢复。

| 来源文件 | Bytes | SHA256 | 形式/尺寸 | ZIP 核对 |
|---|---:|---|---|---|
| `pg02_n_1/code.html` | 25,023 | `2e9fba3bed3e6a075be13b75d0c3d4af75ad000e6f50c6f799828472c17a1583` | HTML | 同字节 |
| `pg02_n_1/screen.png` | 330,041 | `5b4094ff4604eefdb8af7a83f5896612a2d1967f58f6c32ea211718a74cdf4ba` | 435 × 1600 | 同字节 |
| `pg02_n_2/code.html` | 19,462 | `0c9f0bf0d8fcf45ef781477c3dfa0339ebfb9823080b61b530bed746ac36c32c` | HTML | 同字节 |
| `pg02_n_2/screen.png` | 322,947 | `9c0502bafef6fa63b3051e42b03c407598a6767746e713f6a51f740b60ae52de` | 620 × 1600 | 同字节 |
| `pg11_c_alex/code.html` | 20,410 | `a08e381cfc4ff5a2af57bb8341cfafc85937175c86cd1ea3d29f2a4e91f9dc04` | HTML | 同字节 |
| `pg11_c_alex/screen.png` | 320,991 | `c7a62c63d50e5713e43becdd80cc6cdf0bd02bc3c208e7843414262b14cd9c44` | 616 × 1600 | 同字节 |

只读文件盘点 `/private/tmp/caper-wave68-messages-gap/readonly-source-inventory.json`，SHA256 `a996eb7fccf1a36d7dff0ffceebfcf4e8c0b9edbddceb69288fe20bacb226412`。素材/Material 节点原 attr 与父类链记录 `/private/tmp/caper-wave68-messages-gap/readonly-material-inventory.json`，SHA256 `887a51d73b1faddf573ca677c988f75a389f4a3b14fbf9a1ba1998bb71880138`。这两份是盘点数据，不是测试 PASS。

| 当前快照 | Bytes | SHA256 |
|---|---:|---|
| `miniprogram/pages/messages/messages.wxml` | 21,339 | `7b8e9bc25ee9175d68210517e9091377d0ca461df0a2e41541729f8aabdb9b9a` |
| `miniprogram/pages/messages/messages.wxss` | 33,781 | `4473440860e25493bd4875a6515dce0b421e5a5a2fa06f36a8d2083e4541ad65` |
| `miniprogram/pages/messages/messages.js` | 30,759 | `799d2a61281dbb9ffceca63d2fe86a467201ef6de88543c40887ecfd1f2de1e3` |
| `miniprogram/pages/messages/messages.json` | 63 | `b76e69c65eadf25397e0df5c9457c5a098c1bfc714ae05be5441318bdc8ebacc` |
| `docs/stitch-ui-parity.md` | 92,939 | `d34303ef8b949732ef2efca058a5688bcd443bea5af4db2c1aefadcea96705dd` |
| `src/feature-flags.ts` | 1,042 | `e550c4225f89e32678e0778402acb5f47b1f00e9b3febde0e460465368cc0c54` |

这些是本次读取的快照；若 root 更新其它证据，不把快照 hash 当作最终 commit 证明。

## 2. 三稿不能混成一个“原版”

| 原稿 | 实际结构 | 现有状态映射 / 差距 |
|---|---|---|
| PG02-N1 | 56 px `Event Detail` header；28/36 px 通知中心标题及全部已读；四个 intrinsic 宽 pills；32 px icon + meta 上排、正文次排、64 px 场景图；丰富 map / applicant / expense 子卡；温暖 sparkle footer | 唯一 `CENTER` 的现有 markup 更接近此大体层级，审批蓝左灰右也按它恢复过，但 px、字体、准确 Material、原颜色、图和 footer 尚未完整恢复 |
| PG02-N2 | 同 56 px header；**无通知中心大标题/全部已读横排**；32 px 高 pills；40 px icon + title/time/body 横排、56 px 图；较紧凑 CTA，32 px 审核按钮右对齐；英文签名 footer | 目前与 N1 共用同一个 `CENTER`，没有独立 compact 模式/入口；真实筛选与 CTA 存在，不能据此说 N2 布局已复制 |
| PG11-C Alex | 64 px private header / activity、call、more、person；56 px 活动 context；安全提示、时间线、36 px 人物头像、78% message bubbles、quick chips；64 px 底部 composer | 已映射 `CHAT_UNAVAILABLE`，真实入口/返回存在，原 fake 人物/对话/online/发送不可复制为业务；其外围壳的尺寸、glyph、字体和原场景图仍有可完成差距 |

最低风险下一批先明确 **N1 是当前 CENTER 的来源**。N2 是另一份完整稿，当前没有来源明确的跳转去它；不能凭空发明一个切换按钮、把 N2 自动归为空态或窄屏模式，或把同一幅混合 UI 算两屏 1:1。可并行准备 N2 独占来源样式/素材，但其公开入口或状态选择需要 root 的明确计划；这不是后端外部资源阻断，也不能妨碍先恢复 N1 与关闭态壳。

## 3. 共通字体、CSS 与 native 适配

三稿 fontFamily 均为 Plus Jakarta Sans，heading/label/body 具体 token 与个人页同系列：17/22/600（headline-sm），28/36/800（display-mobile），20/26/700（headline-md），15/21/400（body-md），13/18/400（body-sm），13/16/600（label-md），11/14/700（label-sm）。当前 CENTER / CHAT 未声明 Jakarta，app.wxss 只给 page16px，没有引入该字族；因此加载全局 face 不会自动把这两壳改成 Jakarta。

三份原 Jakarta link 只请求 **400 / 600 / 700 / 800**。N1 费用类别文字有 `font-medium`500，但没有 500 face；原 CSS face 选择会匹配 400（对 400–500 范围按规则先找至500，再向下找）。这是根据原请求集合与 [W3C 字重匹配规则](https://www.w3.org/TR/css-fonts-4/#font-style-matching) 的推导，区别于实际微信 raster 测量。既有官方四 face 缓存 `docs/design-sources/reference-fonts/plus-jakarta-sans-css2.css` SHA256 `cc247a76d65a640e62a0a925934a8ec156d9746ba20b8ed3d23ab295cc5c4a3b` 的声明也只有这四面。若把500直接补进共享 `Plus Jakarta Sans`，会改变旧页面该节点的面选择；root 已计划把新增500注册成仅 A/C 显式引用的专用 alias，最终证据与运行需另验。本审计不自行修改共享字体。

三稿所有 header 返回 span 均 **24 px，normal400，FILL0**，无 font-semibold；不可借本批 profile 新 600 返回作为等价图形。后置 Material link 只列 wght/FILL；准确使用其 24pt / GRAD0 默认条件，N2 的五个大 icon 明确 FILL1，Alex verified_user 明确 FILL1，其它源 glyph FILL0。三份稿都**没有 inline SVG**，不能用 INBOX 的原 inline search/settings 或字符 `‹ / ⚙ / ϟ / ◷ / ⌖ / ✓` 冒充这些 Material outline。

原 `space-lg=16 px`、`space-md=12 px`、`space-sm=8 px`、`space-xs=4 px`、`space-xl=24 px`。不可把 space-lg 当24。原 `py-0.2`、`backdrop-blur-xs`、`rounded-tl-xs / rounded-tr-xs`、N1 `active:scale-98` 在当前无相应 extend 的 Tailwind v3 默认下无效：不得分别猜0.8px、额外blur、2px角或.98 transform。默认配置直接读取自既有官方缓存 `/private/tmp/caper-wave66-event-review/tailwind-3.4.17-source/config.full.js`，SHA256 `8f3394e8a4990a7b678d3462b6e1440b84c11a6c06e55d7b26108b90a1fcc538`。原 body 的 `min-h-screen` utility 优先于低 specificity 的 body884px，不能照 PNG 固定锁成884px。

现 `onLoad` 原 helper `capsuleInset=max(96,ceil(windowWidth-capsule.left+8))`、实际 statusBarHeight、24/96 fallback 不应因样式重构失效。CENTER/CHAT 使用同源 native status，非照抄浏览器状态条；CENTER 原56、CHAT原64内容行需要在 capsule左前方布局，长标题 truncate。Alex 原三个44px工具加32px头像及左侧内容对小屏/微信胶囊天然空间紧张；要记录必要 native 适配，不能私自缩所有px或放大viewport来宣称1:1。source header backdrop24px、80%surface，shadow0 1 8 rgba(0,0,0,.04)；当前 shield 为#f8fafc，并非这两源的#faf8fe，下一批只能按模式隔离。

## 4. CENTER：明确尺寸与当前差距

下表当前 rpx 对比仅按375 CSSpx标定（1rpx=.5px），不是 native 截图测量。源码位于 messages.wxss 的 `.center-*` 段；后置 Wave66 样式均带 `.messages-inbox`，不作用于 CENTER。

| 区域 | N1 实际 source px | 当前 / 待恢复 | N2 独立差异 |
|---|---|---|---|
| 外 gutter/header |16；header56；返回/更多44；person32+左4；标题17/22/600 `Event Detail` |gutter13、header45、字符返回约20×30、齿轮19×22、标题13.5/800；缺原更多/person |同N1header；N2没有下方大标题 |
| 主标题/未读/全部已读 |顶部12/底部4；title28/36/800；badge11/14、p2×4；按钮p6×8、r8、label13/16 |heading margin14/8，title18.5/900、badge8.5、按钮8.5，shape/color不同 |此横排不存在，不能强塞进N2 |
| 四筛选 |容器px16 / py8，gap8，inner底2；p6×14、13/16/600，active primary#004cc8，ALL圆点8；未读只源静态数字 |四button强制等分、gap4.5、font10、min30.5；active#1d64f2混了N2；无准确badge/字重 |h32、px12、gap4、selected#1d64f2、inactive#e9e7ed；reminder badge高16/min16/10px/leading1，实际计数待真实分类数据 |
| feed/cards |外px16、上4/下24、卡间12；p16/r12/无border；shadow-sm0 1 2 rgba.05 |p11.5 / 下10.5、间7.5、.5border、shadow0 3 11 rgba.055 |p12/r12/gap8；shadow0 4 20 -2 rgba(28,41,61,.06) + 0 1 3 rgba.02 |
| 顶色条 |4高，pink#ff2d55→blue#1d64f2→purple#5856d6 |2.5高，近似pink→近似purple→blue；approval另加2px边，N1无此边 |4高，blue→purple→lime，opacity.8 |
| icon/meta/title |icon32/glyph18、gap8；kind11/14/700/time13/18；title17/22/600/mb4 |icon28.5/字符、kind9/850/time8.5、title13.5/850/18.63；颜色为近似值 |icon40/glyph20 FILL1，top2；title与time同排，time11/14；summary13/21.125 |
| body/thumb |summary13/18；body行gap8、my4；thumb64/r8 |summary10.5/15.75、thumb50/r7.5；示意字条8/12是额外真实说明 |thumb56/r8；body横排标题/摘要从icon右侧起 |
| reminderCTA |上mt12/pt8，gap8；label13/16/600、py8/px12，首按钮flex1/蓝#1d64f2、次按钮intrinsic/gray#efedf3 |font10.5、min32.5、p5×7.5、gap5；Unicode▣代qr；第二按钮实际复制地点 |两个flex1 h36，gap4，glyph18；首blue/次#ebf2fe蓝字 |
| approval |group_add18/purple32；title/summary后有p8/r8/bg#f4f3f8 applicant strip；avatar28 overlap8；mt4动作：蓝左flex1、灰右intrinsic |顶部pink字符ϟ、分类/标题/按钮字重均近似；真实审批项按registrationId独立展示，没有真实人物头像，不补假Alex/Momo |bolt20 FILL1/pink40；无独立meta上排；actions右对齐、灰左蓝右/h32/px12 |
| material update |edit_location_alt18蓝32；正文后mt10 map96高/r8，底black60%gradient/p8、pin16lime、label11/14、箭头14 |目前为真实button文字行，无source map96/位置/图；不得把source上海定位当本人真地点 |fmd_bad20 FILL1/lime40；**无map图**，mt8/p2×8定位pill、location_on14 |
| confirmed |celebration18/green32；green#34c759，后gradient bannerp10/r8/mt8、24蓝圆/auto14、chevron14 |✓字符+近似green#16a34a，当前label成局通知/真实详情路由正确，视觉不同 |check_circle20 FILL1/green40；gray statusstrip mt10/p6×8/r8/green8dot/chevron16 |
| expense |wallet18/gray32；title/summary；金额行py8px12/r8/gray、20/26金额；明细/结算pill |没有服务端费用通知类型/数据投影，不能假造¥45或支付接口；现standard卡只真实notice动作 |wallet20 FILL1/purple40；金额嵌summary，紫32高button与灰列表button |
| footer |顶部4/底24；lime40圆/auto20、mb8；title13/16/600、副文案13/18/mt2 |当前margin32.5、font9.5/8.5，缺准确sparkle；原“实时同步”不得暗示R1推送送达 |mt32/mb16、32×4灰短条/mb12；英文17/22/600/letter.025em及11/14副签名，outline60%/40% |

已读/错误/加载/登录/空队列、API外部状态提示、pagination与approval容量说明是实际产品保护范围，源静态截图没有这些状态，必须保留合理实际布局。未读3、reminder2、social1均是 source假数字，当前仅 `unreadTotal` / actualqueue是真数据；若要新badge需从真实当前投影读取且明确分页边界，不可复制静态数或重复计数 approvals。

## 5. CHAT_UNAVAILABLE：可复刻壳与不可造的数据

| 区域 | Alex source px / 几何 | 当前差距及关闭态边界 |
|---|---|---|
| header |h64、side16、gap12；back44/-8；左avatar40/person20，heading17/21.25（leading-tight）/600/max130；工具3×44/glyph22+rightperson32/18 |现h51/gap6.5、back17.5字符、avatar30.5星、标题13.5/850；没有accurate actions/person；sourcegreen12online与Bouldering@7PM不能显示为真实在线/活动 |
| pinnedcontext |side16/mb12；cardp12/r12/exactsource阴影、gap12；photo56/r8，黑gradient40%、10px角badge；title17/22、calendar15、date13/18、purple11badge、detail箭头14 |现gutter13、p8.5、gap7.5、photo45；用另页caper_home照片；当前“没有真实会话”提示/本人活动按钮要保留，不能复制6/6、日期、馆名或剩2天假事实 |
| time/safety |timeline side16/space12；timep2×10/rfull、11/14、gray60%；safety p8/r12/阴影0 2 8 rgba.03、gap8、circle24/verified14 FILL1、body13/21.125 |现time8.5px、safetyp10/gap7、circle18◇、copy10/15.5；时间继续用“当前版本”，非source假星期六10:12 |
| transcript |incomingavatar36、mt2、gap8；bubblemax78%、r16、p10×14、15/24.375 leadingrelaxed；outgoingblue#004cc8/white；ready/count10等局部fontsize受实际CSS级联 |当前真实关闭态为空说明卡，不应生成3个Alex头像、5条往返对话、已读、角色、reaction1或刚刚。壳恢复不能被称为transcript接通 |
| quickchips |上margin16/下8；label11/14+purple6dot；scroll水平gap8、py4；pillp6×12/rfull、13/16/600、白/准确shadow |没有quickchip真实发送；可保持原closed说明或disabled装饰，不添加会保存/填充输入的假行为；原script仅填浏览器input也不是发送 |
| composer |fixedbottomsafe；contentrow64/side16/gap8、surface80%/blur24/准确上shadow；attach44/add22、input44/p12+emoji32/glyph20、voice44/mic20蓝色阴影 |现buttons/input31.5px、outer8×13、gap6，Unicode＋/♬、无emoji；全部disabled且无bindinput/发送要继续保持，不把voice蓝色理解为可录音。body内容保留96px+actualsafe避免遮挡 |

闭态说明、两个真实目标与source空壳之间是明确产品适配；没有源里的用户数据就没有与这张带Alex历史的PNG全屏逐像素等价。准确frame/glyph可以单独通过来源核验，不能将这种适配包装成私聊功能已完成。

## 6. 按钮：源原型行为与现有真实绑定

原 HTML N1：filter handler仅操作DOM类别；mark-all handler仅移除dot/改badge；handleApproval只改按钮绿色与disabled，不发API。N2 script只改pill颜色，甚至没有按类别隐藏card。Alex只有本地toggleReaction计数与sendQuickReply填input，call / mic / attachment / activity / detail 等多数按钮没有onclick。不能把原HTML事件演示当后端真实能力。

| 当前可点控件 | 真实 handler / 路由或接口 | 下批必须保留 |
|---|---|---|
| INBOX通知中心入口 |openNotificationCenter→CENTER/ALL，清search，加载approvals，hiddenTab=true |source状态转换与清搜索；不改INBOX已完成版面 |
| CENTER返回 / CHAT返回 |backToInbox→INBOX/ALL / showTabBar |selected3与隐藏/显示恢复 |
| CENTER设置 |goNotificationSettings→irlProfileFocusIntent notificationSettingsSection→/pages/me/me |clearPrivateAfterIdentityChange guard，路由成功后目标另核身份 |
| 四分类 |setFilter→ALL/ACTIVITY/INTERACTION/SYSTEM，displayed real items；interaction按需要loadApprovals |不改groupFor / item.kind / searchQuery / generation / currentIdentity |
| 全部已读 |markAllRead→POST /me/notifications/open-all，随后refresh真实queue |markingAllRead disabled、fail反馈、staleidentity隔离，非DOM伪清空 |
| 真实单项审批 |approveRequest→POST /registrations/:registrationId/approve，expectedVersion=Number(version)，资格canApprove / approvingId保护 |id/version/canApprove、容量文案、失败后重读；source“一键”仍每项，不批量/不虚构参与者 |
| 审批详情 |viewApproval→canonical /pages/event/event?id=encoded&section=hostSection 或 cohostApprovalSection |真实eventId/isHost，canonical实际迁至activity仍兼容 |
| 提醒主CTA |openNotice→同ID checkinSection，再POST /me/notifications/:id/open |不是永久入场PASS，按当前版本详情页面再核资格 |
| 提醒第二CTA |copyReminderVenue→当前/同noticeid+kind+eventId/eventVersion匹配，GET本人CONFIRMED registration、GET同version已审CONFIRMED/IN_PROGRESS event、wx.setClipboardData |仍准确标“复制地点”；没有坐标不能换成导航按钮，失败/identity/requestid/在途退出保护保持 |
| MATERIAL_CHANGE |openNotice→同ID registrationSection |真实重新确认；不把静态map上海地址变成实际路线 |
| EVENT_CONFIRMED |openNotice→同ID detailsSection |源“进入群聊”必须保持关闭/改为实际查看安排，不能新增群聊服务 |
| standard通知 |openNotice按真实kind→hostCompletion / memberFeedback /个人report/appeal/content等focus /只标已读 |保留通知id/eventId/kind对应真实列表校验、switchTab失败focus清理、成功导航后open API |
| 两类加载更多 / retry / 登录入口 |loadMore / loadMoreApprovals / refresh / loadApprovals / goProfile |snapshot/QUEUE_CHANGED/currentIdentity与LOADING/ERROR/UNAUTHENTICATED文案 |
| CHAT本人活动（context与empty各一） |goMyActivities→先backToInbox再navigateTo /subpackages/profile/moments/moments?filter=all |clearPrivateAfterIdentityChange、真实本人活动；不借它定位假Alex特定event |
| CHAT通知中心 |openNotificationCenter同上 |从关闭态进入真实CENTER而非新虚构会话 |
| CHATattachment / input / voice |disabled=true，无发送/保存/录音绑定 |保持关闭；新accurateglyph本身不产生handler |
| AA去结算 / 临时群 / call / reaction / 快捷问候 |无对应真实能力；费用账本在授权活动expenseSection独立存在，但当前无AA通知输入 |merchant_payments=false，金额/结清凭证/自动订场/临时群/实时online/私聊不得凭UI制造 |

现 CENTER **19 个实际 bindtap**、CHAT **4 个实际 bindtap**，完整 handler 已读。本审计没有执行API/按钮，矩阵E98/E121/E145等历史局部点击仅对应各旧快照，不能当本批新版1:1验收。

## 7. Glyph / 图片与复用范围

三源合计 **43 个静态 Material节点**。以下表保留明确字号和FILL；颜色按源parent/token另解析，不改为“统一蓝色”。全部正常wght400；N1动态mark-all完成态还会出现16px `check` green，审批完成态会出现16px `done` white，须按真实API成功后状态决定是否出现，非本地伪通过。

### pg02_n_1 原 Material 节点

| HTML 行 | Glyph | 字号 | FILL |
|---:|---|---:|---:|
| 15 | `arrow_back_ios_new` | 24 px | 0 |
| 15 | `more_horiz` | 22 px | 0 |
| 15 | `person` | 18 px | 0 |
| 26 | `done_all` | 16 px | 0 |
| 60 | `alarm_on` | 18 px | 0 |
| 71 | `sports_tennis` | 13 px | 0 |
| 91 | `qr_code_2` | 16 px | 0 |
| 95 | `navigation` | 16 px | 0 |
| 105 | `group_add` | 18 px | 0 |
| 142 | `check_circle` | 16 px | 0 |
| 155 | `edit_location_alt` | 18 px | 0 |
| 181 | `pin_drop` | 16 px | 0 |
| 185 | `arrow_forward_ios` | 14 px | 0 |
| 196 | `celebration` | 18 px | 0 |
| 204 | `check` | 12 px | 0 |
| 220 | `auto_awesome` | 14 px | 0 |
| 225 | `chevron_right` | 14 px | 0 |
| 234 | `account_balance_wallet` | 18 px | 0 |
| 271 | `auto_awesome` | 20 px | 0 |
### pg02_n_2 原 Material 节点

| HTML 行 | Glyph | 字号 | FILL |
|---:|---|---:|---:|
| 9 | `arrow_back_ios_new` | 24 px | 0 |
| 9 | `more_horiz` | 22 px | 0 |
| 9 | `person` | 18 px | 0 |
| 36 | `alarm` | 20 px | 1 |
| 54 | `confirmation_number` | 18 px | 0 |
| 58 | `near_me` | 18 px | 0 |
| 67 | `bolt` | 20 px | 1 |
| 104 | `fmd_bad` | 20 px | 1 |
| 115 | `location_on` | 14 px | 0 |
| 123 | `check_circle` | 20 px | 1 |
| 139 | `chevron_right` | 16 px | 0 |
| 146 | `account_balance_wallet` | 20 px | 1 |
### pg11_c_alex 原 Material 节点

| HTML 行 | Glyph | 字号 | FILL |
|---:|---|---:|---:|
| 9 | `arrow_back_ios_new` | 24 px | 0 |
| 9 | `person` | 20 px | 0 |
| 9 | `local_activity` | 22 px | 0 |
| 9 | `call` | 22 px | 0 |
| 9 | `more_vert` | 22 px | 0 |
| 9 | `person` | 18 px | 0 |
| 28 | `calendar_month` | 15 px | 0 |
| 37 | `arrow_forward_ios` | 14 px | 0 |
| 54 | `verified_user` | 14 px | 1 |
| 176 | `add` | 22 px | 0 |
| 176 | `sentiment_satisfied` | 20 px | 0 |
| 176 | `mic` | 20 px | 0 |

关键源色：N1alarm#ff2d55、group_add#5856d6、edit_location#1d64f2、celebration#34c759、wallet#1a1b1f、footerauto#4d5d00；N2alarm#1d64f2 / bolt#ff2d55 / fmd_bad#647700 / check#34c759 / wallet#5856d6；Alexverified/calendar#1d64f2、header actions#424655、composerattach/emoji#424655、voicewhite。

已有可复用**几何候选**（实际sourceaxes/颜色匹配后由下一owner复制/仅改fill，不能跨分包直接依赖）：

| 候选 | Bytes | SHA256 | 条件 |
|---|---:|---|---|
|profile moments/assets/arrow-back.svg（旧400）|173|`b4d72b3ef91399480f63d49489df5b8ff1b26436974b423b3c60d11b103ff854`|FILL0/wght400/24源几何和#1a1b1f；不用新266B profile600 |
|pages/city/assets/more_horiz.svg|423|`51e679c18d8ef69ac46b006148167c62824958920f54eced6bd828d24a3ee7c4`|源22px显示、FILL0/400、#1a1b1f；证明在docs/design-sources/main-package-relocated/pages/city/assets |
|pages/city/assets/person.svg 或 profile旧person|544|`d66a89fc9036f18a31f3804ee7b19f52a7954e31cc1cbfbd9b98f206a8299d6f`|white FILL0/400，header18px；Alex左20px需#1d64f2变体 |
|pages/city/assets/near_me.svg|170|`7601a48abfd234908fefc56f4f1a15837606e73dfb2e009cf0630652a0d914dd`|N2导航图形候选，原CTA实际必须仍叫复制地点，不称导航接通 |
|pages/about/assets/arrow_forward_ios.svg|172|`7a91e77baba8c5789a040736afe165f6596b18e60e769cb9c788f0ccca2b1a8a`|400/FILL0，需按相应label原lime或electricblue改fill |

这些是只读资产盘点，未再次证明fontglyph全部相同；应复用已有官方source记录，新增缺失准确glyph时做独立轴/路径来源证明，不能手绘替代或直接把Phosphor图当Material。

图片明确未相同：当前 CENTER reminder与CHAT context都用 `/assets/stitch/caper_home_badminton.jpg`（56,146 B，SHA256 `df87413d3555b9f9b7cb7428a23ad2cbe1dad270fade6f53867ab29e29f2647d`）。它是现已标示的跨页示意图，**不是** N1明亮蓝球场、N2蓝球场球头特写、Alex木地/绿色球场各自原URL的字节证明。N1原还有96高上海map背景和两份28px人物头像；N2两份不同28px头像；Alex三份不同36px人物头像。三稿总 **11 个不同远程图URL**（4 / 3 / 4），URL全文可从上述原HTML与tmp inventory重读，ZIP并未把这些URL都作为独立原照片提供。本任务没有联网下载、裁图、重编码或造人物；下一批仅原场景示意资产值得有依据准备，人物与地图位置仍须真实授权数据/明确关闭说明，不能为了像素假造用户或地址。

## 8. 最小下一批与互不干扰的并行边界

1. **唯一 messages 产品 owner**：先恢复CENTER的N1 source px / Jakarta / normal400 Material / source colors / header与footer，保留真实notice与approval投影、现有点击语义；只追加 `.center-shell`（或明确CENTER根类）scoped CSS，原完整INBOX与CHAT保护。新badge不能hardcode。N2另记未实施，避免一次混合两稿。
2. **独立 CHAT 原稿准备 owner**：并行只在独占tmp与docs准备 Alex准确400/FILL1 glyph、场景来源、frame64/56/24/44/字体/底safe声明，以及关闭态原绑定映射；先不改同一个 messages.wxml/.wxss。CENTER冻结之后由唯一产品owner或明确交接owner接入CHAT壳，并保留现有4真实路径和disabled input；无新fake人物、transcript、online或发送API。
3. **独立 source reviewer / root**：源审查上述两个scope与INBOX保护；root做最终编译实际主包预算与受影响CENTER/CHAT有限原生/SDK点击。所有新SVG成本应先报rawbytes；3份原图不是普通“补一张相似照片”，未下载不能预估包体PASS。字体复用已存在的四面，无需新增完整Materialfont库或复制docs证据进主包。
4. **N2待明确plan的独立批**：其完整compact版可以继续只读准备，但当前没有对应入口；若最终要第二个通知视图，root应明确实际可达方式和原/新viewMode保护，不能以原N1/CENTER已可点击宣称N2完成。

这套并发安排防止两人同时写同一 WXML/WXSS；不能仅按两branch互不重叠便声称共享文件无冲突。也不为这次只读盘点创建新组件、改 app.json 或换业务接口。

## 9. 已完成 INBOX 的保护快照与验收边界

Wave66原INBOX header/priority已在独占报告 `docs/evidence/caper-messages-reference-ui-wave66-2026-10-02.md` 冻结并由 E161覆盖限定运行。本次当前整页 WXML/WXSS/JS hashes仍与其freeze表相等。可用于下一批逆还原保护的实际分段：

| 当前分段 | Bytes | SHA256 |
|---|---:|---|
|WXML文件头至CHAT_UNAVAILABLE前（含完整INBOX）|11,485|`2d894789f70c2174044a0191a4cd940c8dec44f0a64d595f446db706b58cb7f4`|
|CHAT block至CENTER outerelse前|2,113|`fbb231907f480b21e8029afb19e2b38c5f34b2bb40f4e0713338e49151486d35`|
|CENTER outerelse至文件末尾|7,741|`9fa55c7a012c575103425992aaf71eff6833e3e3b3f5c823738bf10276f17b81`|
|Wave66注释`/* caper_3 source px;`起的INBOX scopedCSS|5,104|`4872e76f36a9a95d25700875f0d8f3fc50c54fa761666041abd731a33bdcf3e7`|

全页面通用 `.card / .messages-page / .messages-status-shield` 属共享有效级联，不可为CENTER/CHAT改成新全局基色/字体/边距而污染 INBOX。JS当前30,759B / `799d2a61…` 是真实队列、原身份隔离与返回的保护基线；需要任何helper几何变更时由root明确授权，并给定点inverse，不能在样式owner中顺带重写。

最终结论：**N1 / N2 / Alex来源差距已盘点，尚未实施本报告建议；已有真实R1按钮是代码可达，不是本批实点；三屏不具备全屏逐像素/私聊/支付已完成结论。** 外部正式AppID/HTTPS/订阅/真机/运营仍是总项目独立边界，不阻止本地继续恢复上述来源明确的frame与准确图形。
