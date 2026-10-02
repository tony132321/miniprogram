# Wave 70 等待冻结期间：未独立入口与分享背景只读盘点

## 范围 / 结论

本文件是后批实施输入，不是实施或验收报告。基线为已提交 Wave69 `b45a99d0749fd1c4a14f88fa588b244b6a844a4d` 的 immutable archive `/private/tmp/caper-ui69-immutable-rypwxq5y`；只读原 HTML / PNG、39行矩阵与既有路由 / 状态，避免读取并发 owner 的中间修改作为结论。没有改产品、配置、总矩阵或 Git，没有运行微信 / CLI / SDK、业务 / 全量测试，也没有新增入口。

优先建议仍是完成已获明确范围的 Wave70 首页B / C / D、PG07及 `_2` / `_4`。随后可并行补普通首页 / 发现 / 我的 / 消息长页的尚未来源核实范围，以及已有分享弹层背景；N2 / `_5` 需先确定入口归属，不能把现有能力、同一路由或历史截图直接计为这两个布局恢复。

## 1. 39行当前盘点口径

读取 immutable `docs/stitch-ui-parity.md` 的三个逐屏区，按设计代号精确得到39行；完整原行与归组保存在 `readonly-unrouted-and-background-inputs.json`，没有更新总矩阵。

| 归组 | 数量 | 本轮解释 |
| --- | ---: | --- |
| Wave70实施中、等待各owner freeze | 6 | `pg02_b` / `pg02_c` / `pg02_d`、`pg07`、`_2` / `_4`；不可预先计为完成 |
| 没有独立入口合同 / 原稿布局未恢复 | 2 | `pg02_n_2`、`_5`；与 N1 / PG06 共用历史能力不证明这些源布局已实现 |
| 有此前限定实施 / 证据，需保持其原有边界 | 31 | 每行原矩阵的范围保持；其中包含部分首屏、外围、示意图片与前景弹层，不代表31屏全长逐像素通过 |

31项不是“其余全屏已完成”。矩阵已经明确：普通 `caper_2` / `caper_4` / `caper_1` 的早批工作侧重首屏核心；`caper_3` Wave66恢复INBOX header / priority，其他长页仍保留旧实现；`pg06_s` Wave69只恢复前景，背后仍是 `_3`。这些都已有真实入口，适合在各自页面文件范围独占继续做源恢复，不需要设计新的产品入口。

N1 / Alex仍使用明示示意的既有羽球图而非对应原照；后续若需要原图片相同，应按这两张source确切URL取得二进制并证明身份 / 预算，不可将当前56,146B图当原照。凡虚构人物、照片字段 / 真活动相册不存在、付款 / AI / 自动订场关闭的内容，视觉完成条件仍须区分当前R1可实现外围与不存在的真实数据能力。

## 2. N2：有共用通知能力，没有独立紧凑布局入口

完整读取 `/private/tmp/irl-stitch-original/stitch_design_system_generator/pg02_n_2/code.html`，19,462 B，并实际查看原 PNG（322,947 B）。原HTML唯一onclick为 `history.back()`；原tail脚本只是4tabs的 DOM selected样式切换，没有链接到本屏或绑定后台CTA，也没有说明由哪个实际入口在N1 / N2之间选布局。

immutable app.json无N2 page；messages.js仅有INBOX / CENTER / CHAT_UNAVAILABLE。CENTER当前稳定恢复的是N1，有通知中心大标题 / 总未读 / 全部已读按钮、32px分类图形与16px卡内边距。不能把“同一个CENTER有四筛选”认作N2源几何已完成，也不能直接覆盖N1来满足另一屏。

### 已确认的最小源结构

| N2原有效结构 | 与当前N1不同的点 |
| --- | --- |
| 原header56px、侧16px、back44 / glyph24、more44 / glyph22、person32 / glyph18 | header身份与native capsule可以复用当前必要适配；N2没有源通知大标题 / 全已读行 |
| header后横向4tabs：h32、横12、gap4、row py4，section top4 / bottom8 | selected #1d64f2，不是N1 selected #004cc8；活动提醒红badge需真实计数，不能填源2 |
| feed gap12 / 顶4；卡p12 / 圆12 / gap8 | shadow为0 4 20 −2 rgba(28,41,61,.06) +0 1 3 rgba(28,41,61,.02)；提醒顶渐变4px为蓝→紫→lime、opacity.8 |
| 圆图40px / glyph20；提醒thumb56px / 圆8px | N1圆32 / glyph18、图64不能直接作N2来源证据 |
| title17 / 22 / 600、time11 / 14 / 700；summary13px leading-relaxed=21.125px | `font-body-sm` family类本身不是字号，`text-body-sm`与`leading-relaxed`实际级联才决定字号行高 |
| 提醒两CTA h36、glyph18；审批 compact CTA h32 / 横12 | 原N2审批顺序详情在前、通过在后，和N1不同；真实registrationId / version / canApprove必须保持 |
| 位置pill 2px / 8px、glyph14；成局chip 6px / 8px / 圆8px | 无坐标、群聊 / 日程契约时保留实际最新安排入口与明确关闭提示 |
| source footer上32 / 下16，handle32×4 / bottom12 | footer17 / 22 headline和11 / 14 label，与N1 40px orb footer不同 |

N2图标全部最终400；FILL1是alarm / bolt / fmd_bad / check_circle / account_balance_wallet，其余FILL0。共12个glyph/color/size槽；back / more / whiteperson可复用当前实际准确SVG，其他必要variant先核现有同路径、同axes / fill / color后再导出。原fullv374 / Version2.972与既有Jakarta400 /600 /700 /800足够，不新增font。

原3图资源是1张羽球示意、2张虚构审批头像；此审计未下载，未知JPEG实际字节。两张人物图不可以显示为真实申请人。源“导航前往”、临时群聊、费用结算 / ¥45.00没有实际契约，不能复制假成功。真正有R1数据的kind可继续用当前present、approval和openNotice / copyReminderVenue / approveRequest能力，失效和身份guard保持。

### 可独占方案 / 必要决定

在明确N2入口归属后，由单一Messages owner独占messages WXML / WXSS、必要小SVG / 来源；可选择隔离实际CENTER layout状态，或明确独立路径但复用既有projection / methods。入口归属目前没有source或R1合同，本审计不替root创建layout切换器、不按设备宽度任意自动选屏、不修改JS或app.json。

无须新通知后端；最小实施检查应是N1 / INBOX / CHAT保护、N2既有CTA属性与资格、原px / glyph，以及受影响一次route验证，不扩大成全量。

## 3. `_5`：原只读终端，不是当前PG06工作台的另一名字

完整读取 `_5/code.html`（25,760 B）和实际查看PNG（377,418 B）。唯一onclick为history.back，无写入按钮、独立入口或15秒refresh实现。原稿主标题“主办工作台 (实时看板)”与“当前终端仅供观察监视”，但实际内容中的自动运行、天气22℃、场租支付和AA付款均是示例，不可由静态HTML推出真实能力。

现event.js `sectionAvailable('hostSection',...)`仅允许isHost；WXML的该同一授权scope已经恢复PG06 Organizer Dashboard。没有另一个 `_5` 状态 / section / route，不应把PG06画面计为 `_5`，也不应替换已有工作台使审批 / 公告 / 结项入口丢失。

原UI可恢复的只读组件包括：

- 56px header与20 / 26 /700终端标题、green状态pill、13 /18摘要；侧边16、卡间12。
- hero / metric card p12 /圆12；原电蓝−40px /128px圆blur40与violet−32px /112px圆blur24光晕；四列12px gap、stat p8 /圆8、20 /26数字；10px进度条。
- 成局条件卡p12 /圆12 / gap8；condition row p10 /圆8、24px绿色circle / 16pxcheck。已确认、最低人数、场地自报和审核状态需真实字段；无时间阈值能力时不填“48h /安全期”。
- AI状态卡原渐变 / 28px orb /16pxsparkle，15px leading-relaxed=24.375px；文字只能说明实际R1本地规则 / 提醒状态和关闭能力，不能冒充已安排天气 /送达成功。
- roster row p10 /圆8、40px匿名头像；只展示服务端有资格可读的实际confirmedRoster，不把授权列表全部当确认人数，不加固定6人 /等级 /累计参局 /付款字段。
- 场地块128px h /圆8、有确切source地图URL但非真实定位；不填假订单号、锁场支付证明。无有效定位 /单据能力时只能保持已核实事实或清楚关闭说明。
- 原footer p4 /8、胶囊8 /16；终端ID、云端同步与禁止写入文字不可冒充工程已经提供的终端设备能力。

### 字形与未定义值的必要边界

一次source CSS-only观察确认 `_5` 的3个 `.material-symbols-outlined.font-bold` check最终weight700，其他glyph400。不能因为官方symbol class默认normal就强制全400；也不按class书写顺序推断，使用实际生成CSS观察。可复用Wave69原fullFILL / wght face，不重新下载字体或用同名subset未证实的700path替代。

FILL1明确为sports_tennis / verified；font400。其余FILL0，check700；cloud_done15px与footer16px各有一个size节点。原 `py-0.2`没有有效定义，观测top / bottom0；`shadow-xs`没有有效shadow，观测none。不要猜.8px padding或造新shadow。原body含text-body-md有效15 /21，与只含family的N1 / N2基础16 /24不同。

原7媒体槽为6张示例人像与1张上海地图background，此审计不下载人物 / 地图，不改变当前资产或报告节省；需要同源二进制 / bytes时由后续实施按准确URL决定，未知不估算。

可独占实施文件仍是event WXML / WXSS与必要accurateassets；须等Wave70同文件ownerfreeze后，由root先决定只读终端的授权入口归属和真实字段映射，再独占实施。不能与PG07 / `_2` / `_4`并发写同两文件，也不复制造一个新的审批 / 支付系统。

## 4. PG06-S：前景已来源恢复，背景有明确剩余差距

Wave69独审已经证明原foreground几何、8准确glyph / FILL0 /400、原64px照片与当前share绑定；此处不重复该source检查。原HTML share-sheet-modal前面的背景是PG06 Dashboard（英雄图、报名 /数据 /管理结构，并叠dim / blur），当前share.js承载的是实际 `_3`邀请卡，`shareSheetOpen`只开同页sheet。因此整screen.png背景仍不同，此差距不能用前景完成抵消。

已有真实路径是PG06主办工作台 `openShareCard` → 当前share页面 → `openShareSheet`。share.refresh已读受权限保护的当前event，强校验event.id、hostId /actor、identity / generation与安全 /审核 /邀请码期限；display仅保留真实title、状态、起止、粗城市、confirmed / minimum，不显示具体场馆。后续视觉背景可复用这个已授权event快照与准确PG06样式 /既有素材，无须新后端或创建一个假活动。

最小可独占scope：share.wxml /wxss在`shareSheetOpen && loadState==='READY'`时额外呈现源Dashboard只读背景，普通 `_3`完整前缀和关闭后的真实邀请卡保持；只读投影不增加binding，不泄露具体地址 / token到场景背景，不放源虚构人像 /报名数字。foreground保持旧冻结字节，关闭 /copy /poster /native share实际方法保持，继续由root保护期限 /账号切换行为。

该方案可以在Wave70与Messages owner独立文件范围实施，但当前只作建议，尚未动产品。原Dashboard背景有哪些非敏感stats可直接使用要由实现者逐字段检查已有event.stats；不存在字段不能以0/固定进度伪造完整来源。若要把sheet直接迁到event的PG06而不是补share只读背景，则会触及canvas /sourceToken /share-intents /期限 /页面隐藏机制，不是纯样式补丁，需要独立计划与限定验证；不建议把现有分享能力随意搬过来。

## 5. 可并行下一批范围 / 预算

| 顺序 | 单一owner范围 | 来源与实际界限 |
| --- | --- | --- |
| 当前先完成 | index B/C/D；event PG07后 `_2` / `_4` | root已有Wave70计划；本审查者等待各freeze再独立review |
| 后续可并行 | `index`普通长页、`discover`长页、`me`长页、`messages`INBOX未恢复长页，各自WXML /WXSS与accurateassets | 这些都有真实入口；先逐段读原稿和当前最终scope，保持已验首屏 / mode /绑定，不使用当前早批片段当全长source证据 |
| 可分开插入 | `activity/share`的PG06-S只读背景 | 不与event两文件竞争；精确保留前景 /JS /JSON与原_3，已有event快照可复用 |
| 先确定入口 | N2和`_5` | 原稿 /当前R1没有独立入口合同，不能任造切换器；未来独占Messages或event相应mode，复用已有业务 |

Wave69最后CLI矩阵记录main1,993,189 B /余103,963 B；本审计不运行CLI，不把这个历史实测当Wave70新包体。现计划原始main新增资源上限80KB，图片真实bytes未知，不声称可塞入当前主包；若需要照片、优先复用确认同字节资产或位于所属activity分包。源PNG不能作整页背景，不能降低图质或换字体子集来估计预算。

所有上述剩余工作都没有实施 /验收；本文件不新增完成百分比、39屏通过数或外部资源完成声明。

## 输入追溯

- `pg02_n_2` HTML SHA `0c9f0bf0d8fcf45ef781477c3dfa0339ebfb9823080b61b530bed746ac36c32c`；PNG SHA `9c0502bafef6fa63b3051e42b03c407598a6767746e713f6a51f740b60ae52de`。
- `_5` HTML SHA `e2a2ce2fb2266283f7762dca23592c732eca385d88ce1772f1e22a41bec8b024`；PNG SHA `c304525527f9fcab9c7e6646ed13e8b63a3febeff3c34880f8f1ff91f7b7b3cb`。
- 完整39行 /原稿媒体URL /现immutable输入hash：`/private/tmp/caper-wave70-unrouted-background-audit/readonly-unrouted-and-background-inputs.json`（57,304 B，SHA `eaa1596938b93d95bfb0e89d93a678c3e4cd51c6c9d166ed6b884d89c28245aa`）。
- N2 / `_5`原CSS-only观察与脚本在同prep目录。复用既有captured Tailwind3.4.17与原v374末faceCSS；所有font /image binaries阻断、无network新资源 /product /业务点击 /SDK。它证明CSS属性级联，不证明字体实际绘制、文字换行或historical PNG绘制过程。

### 普通四长页的字体输入补充（只读）

已按原HTML直接读取四稿fontFamily / CSS声明：`caper_1`与`caper_2`正文是各自明确系统family数组；`caper_3`正文系统family，handwriting是 `"Comic Sans MS", "Chalkboard SE", sans-serif`；`caper_4`正文系统family，handwriting是 `"Caveat", "Segoe Print", cursive`，其自定义CSS手写note另有cursive /sans fallback。它们不是把所有页面强制改成Jakarta的依据。

原caper_2只外链Caveat600 /700与Permanent Marker，已有Caveat字体优先项可复用；caper_1 /3 /4没有字体下载link。消息长页手写贴若后续恢复，应按原实际handwriting节点family，而非新造字体或直接换Caveat；Comic Sans /Chalkboard在目标native平台是否可绘制尚未验。当前四页首屏已有各自scope系统family和首页两句Caveat /发现citynote，源码family相同仍不证明本机 /真机字形完全相同。此盘点未新增 /下载字体，不改变global加载。
