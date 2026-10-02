# Wave 69：PG02-N1 通知中心 / Alex 私聊关闭态独立来源审查

## 结论与范围

对冻结的 N1 CENTER 和 Alex `CHAT_UNAVAILABLE` 做了一次独立源码、素材、真实动作与保护区域审查；没有发现需要修改产品的明确偏差。唯一待核的 `verified_user` FILL1 字形已用原全字体有效 `rclt` 置换补完局部来源证明，最终路径与产品 SVG、保存子集相等。

本结论限于源代码、资产轮廓、绑定和既有业务前置条件。没有运行实施者 checker、业务测试、VM、全量、CI、微信、CLI、SDK 或 Git；开发者工具实际渲染、点击、字形加载和包体上限由 root 另行验证。本报告不表示两张原 PNG 的全部人物、照片、示例记录或所有 39 屏逐像素完成。

审查基线为 Wave 68 `2e3e027`，被审实现者为 `ui64_review`。本审查者只新增本报告与 `/private/tmp/caper-wave69-messages-independent/` 观察证据，未更改产品或实施者证据。

## 1. 独立读取的输入与冻结

完整读取了原 N1 / Alex HTML，实际查看了两张完整 PNG；读取 WXML / WXSS / JS / JSON、实施报告、来源 JSON、绑定证明、23 项 glyph manifest、保存官方 subset 与现有原 full TTF。原 PNG 导出 435×1600 / 616×1600 只用于观察，不作为 CSS viewport 或固定页面高度。

| 输入 | 原始字节 | SHA-256 |
| --- | ---: | --- |
| `pg02_n_1/code.html` | 25,023 | `2e9fba3bed3e6a075be13b75d0c3d4af75ad000e6f50c6f799828472c17a1583` |
| `pg02_n_1/screen.png` | 330,041 | `5b4094ff4604eefdb8af7a83f5896612a2d1967f58f6c32ea211718a74cdf4ba` |
| `pg11_c_alex/code.html` | 20,410 | `a08e381cfc4ff5a2af57bb8341cfafc85937175c86cd1ea3d29f2a4e91f9dc04` |
| `pg11_c_alex/screen.png` | 320,991 | `c7a62c63d50e5713e43becdd80cc6cdf0bd02bc3c208e7843414262b14cd9c44` |

原稿位于 `/private/tmp/irl-stitch-original/stitch_design_system_generator/`；实施来源 JSON 已记录与用户 ZIP 对应条目同字节。本审查读取这些原文件，不重新下载图片，不借其他屏示例替代这两屏来源。

冻结清单 `/private/tmp/caper-wave69-messages/frozen-owned-paths.json`：6,759 B，SHA `d3f8387dbe6ed32fa180393b43f266f822d9f2cfba2c47c41e3ddfa1706c7b8f`。独立检查 33 个 owned 条目及 2 个 protected 条目的 bytes / SHA，全部与冻结相等。此处 hash / JS 字节结论对应 owner 的 source freeze；后续 root 在 SDK 发现的必要运行修正另列，不将此初始 source freeze 伪称最终 runtime freeze。

| owner source freeze 产品 | 冻结字节 | SHA-256 |
| --- | ---: | --- |
| `miniprogram/pages/messages/messages.wxml` | 25,349 | `016d85c858bceb0cedc77f3d276d9c8737fe2d2ff91f02f3188bd64d6f16f41c` |
| `miniprogram/pages/messages/messages.wxss` | 56,674 | `a6ba47ac7cade2ec7b42187a803207a7b7165c4a1e914f57fd233c8157cc98e0` |
| `messages.js` | 30,759 | `799d2a61281dbb9ffceca63d2fe86a467201ef6de88543c40887ecfd1f2de1e3` |
| `messages.json` | 63 | `b76e69c65eadf25397e0df5c9457c5a098c1bfc714ae05be5441318bdc8ebacc` |

实施者来源与保护证据分别为 `caper-messages-center-chat-reference-sources-wave69-2026-10-02.json` / `caper-messages-center-chat-binding-proof-wave69-2026-10-02.json`；独立审查未运行其检查器。

## 2. 原有效 CSS 与布局范围

新增 CSS 从 `messages.wxss:327` 追加，模式限定在 `.messages-center-reference` / `.messages-chat-reference`。原 body 的 `font-body-md` 是 family token，原网页基础字号仍 16 / 24；产品两模式在 330 行指定 16px / 24px / 400，与实际有效来源一致。没有把 family 类名称误当 `text-body-md` 的 15 / 21 字号。原 `space-lg / md / sm / xs / xl` 依次为 16 / 12 / 8 / 4 / 24 px。

只使用原 N1 / Alex 请求及现有 Jakarta 400 / 600 / 700 / 800 faces，没有接入专供 profile 500 的 alias。新模式按钮继承原 Jakarta；原图标自身 normal400 另见字体章节。

| 原来源结构 | 产品限定 selector / 观察 | 来源核对 |
| --- | --- | --- |
| N1 header / 标题 | `.center-header`、`.center-heading-title` | 56px 行、16px 边距、24px 返回图标 / 44px touch、Event Detail 17 / 22 / 600；通知中心 28 / 36 / 800、−.025em |
| N1 未读 / 全已读 / 筛选 | count / read-all / center-filter | count 11 / 14 / 700 / .02em、2 / 4 内边距；已读 13 / 16 / 600、6 / 8；筛选 13 / 16 / 600、6 / 14、8px gap、全部 8px lime dot |
| N1 feed 与通知卡 | `.center-feed` / `.center-card` / `.center-highlight` | 外侧16px、上4px / 下24px、间12px；卡内16px / 圆12px；提醒顶条4px原粉蓝紫渐变，32px圆 / 18px glyph |
| N1 卡中文字 / 真实 CTA | kind / time / title / summary / actions | label11 / 14 / 700、time13 / 18 / 400、title17 / 22 / 600 / −.01em、summary13 / 18；CTA13 / 16 / 600、8 / 12、16px glyph；提醒配图64px / 圆8px |
| N1 分类图形 | approval / update / milestone | 审批 purple、位置 blue、成局 green 按源；位置96px占位与8px圆、成局渐变条10px内边距 / 圆8px / 24px orb / 14px glyph |
| N1 页尾 | `.center-footer` 与 orb / title / copy | 40px tint圆、20px glyph、标题13 / 16 / 600、正文13 / 18、上4px / 下24px |
| Alex header 与 context | private-chat-header / avatar / context | 64px行、返回44px / −8px左 margin、40px头像、17px leading-tight=21.25px、56px场景图 / 圆8px、context内12px / gap12px / 原两层shadow |
| Alex safety | private-chat-safety 与 icon | 8px内边距 / gap、圆12px、24px circle、top2px、14px FILL1、13px leading-relaxed=21.125px、原0 2 8 shadow |
| Alex conversation footprint | private-chat-time / empty | 时间11 / 14 / 700、2 / 10；真实闭态采用源消息泡的10 / 14内边距、圆16px、15px leading-relaxed=24.375px、原0 2 10 −2 shadow |
| Alex composer | private-chat-composer 与 controls | 64px行、16px侧边 / gap8；附件 / 语音44px、22px / 20px glyph；输入44px / 横12px、15 / 21，placeholder源 #737687；emoji32px / glyph20px；24px blur与原shadow |

原 `active:scale-98`、`backdrop-blur-xs`、`rounded-tl-xs` / `rounded-tr-xs`、`py-0.2` 没有有效 Tailwind v3 定义，本批未补猜值；没有从未定义 token 推导额外尺寸。`min-h-screen` 的有效优先级覆盖原 body 884px min-height，本批保持随真实内容 / viewport，不固定导出高度。

CHAT main 原 `pb-24=96px` 与内层 `pb-6=24px` 都落实为 shell 底部 96+24+native safe；关闭输入的 placeholder 色与这项内层 padding 是实施者完成必要检查后的定点来源补充，本审查读取的是最终冻结值。

### 原生位置与未声称相同的部分

原 JS 的 `statusBarHeight` / `capsuleInset` 计算保持，56 / 64px sticky 页头仍在正常布局流中，顶部由真实状态栏代替浏览器 safe inset，右侧保留真实胶囊位置。读取旧 CSS 证实 header 是 sticky；没有将其误判为脱流 fixed 后再主张缺少占位。

Alex 原同一行的 3×44px 工具和 32px 人物圆标在实际胶囊宽度下移入第二个 disabled 工具行，保留原 glyph / touch 尺寸。这是明确的 native 位置适配，不等同原浏览器同一水平行；需 root 实际检查小宽度设备。

## 3. 23 项 Material 轮廓与真实有效字体

直接读取保存官方 CSS / WOFF2 / TTF：最后同 family 的 `Material Symbols Outlined:wght,FILL@100..700,0..1` face 覆盖较早 opsz face；保存 subset 请求只加 `icon_names`。实际 Version 2.972 / v374，仅 FILL0..1、wght100..700（默认400）为变量，opsz24 / GRAD0 固定。原 span `.material-symbols-outlined` 的 `font-weight:normal` 生效，所以实例为400，不随外部600 / 700文本继承。

保存 subset WOFF2 为8,980 B，SHA `fd821798ef97f95e1ef22b0858b44bba40c9a3dca6c0ff43cb35a0a21cf21f80`；decoded TTF 17,684 B，SHA `90c1c271bd19e9c46400bca24710238a105718c02d03722536dc2aeccea4cc39`。官方原始 URL / UA / glyph 坐标保存在 `docs/design-sources/caper-messages-wave69/`，许可复用 `docs/licenses/material-symbols-Apache-2.0.txt`。来源字体留在 docs，不新增运行时 font / 外部依赖。

23 SVG 共16,657 B，均在 WXML 实际静态引用。独立从对应 font instance / `renderedGlyph` 导出路径，逐项与 SVG、manifest 相等；root viewport / fill 也相等，负 Y 翻转保留原精确轮廓，没有舍入 / 简化或自画替代。

| 字形 / variant | 原节点 size / color |
| --- | --- |
| `arrow_back_ios_new`, `more_horiz`, `person` white | 24 / #1a1b1f、22 / #1a1b1f、18 / #ffffff |
| `done_all`, `alarm_on`, `group_add`, `edit_location_alt`, `celebration` | 16 / #004cc8、18 / #ff2d55、18 / #5856d6、18 / #1d64f2、18 / #34c759 |
| `qr_code_2`, `navigation`, `check_circle` | 16 / white、16 / #004cc8、16 / white |
| `auto_awesome` white / footer, `chevron_right` | 14 / white、20 / #4d5d00、14 / #004cc8 |
| `person` blue, `local_activity`, `call`, `more_vert` | 20 / #1d64f2、22 / #424655、22 / #424655、22 / #424655 |
| `verified_user` FILL1, `add`, `sentiment_satisfied`, `mic`, `arrow_forward_ios` | 14 / #1d64f2、22 / #424655、20 / #424655、20 / white、14 / #1d64f2 |

### 原 full face 与 FILL1 局部观察修正

复用 Activity owner 已取得的同源完整 face，没有重取整字体：

- full WOFF2 `/private/tmp/caper-wave69-event/sources/material-up.woff2`，1,136,920 B，SHA `77f9711f3f896a1d7a34ab95cffc45cfb17d84c223f197c1b90faa0d043006e9`。
- decoded full TTF `material-up-decoded.ttf`，3,200,992 B，SHA `cf46fa438e9ce2265958fdea4498c31ae5b7b39cb172ebff4f6aedb5aedcbc90`，Version2.972 / 原 lastface v374。

22 个 FILL0 / 400 的原 full ligature 轮廓与产品 / subset 同字节。初次全字形观察只在 FILL1 直接画 full `rlig` 的 `verified_user`，没有应用实例化后激活的 `rclt`；该阶段路径不等不能用来诊断产品缺陷，原观察原样留存。

仅局部补核 FILL1：原 full 实例 DFLT / latn 的有效 features 为 `rclt` lookup1、`rlig` lookup0；full lookup0得到 `verified_user`，lookup1实际将其置换成 `verified_user.fill`。最终 path 与产品 `wave69-shield.svg`、subset manifest 逐字节相等。保存 subset 的同一有效置换为 `uniE8E8 → glyph00012`。产品 shield 明确 SHA `77edac762d11873c5c2d2615a2dc86170d83a860f6ffa3efe7ae77852a8e06d2`。详见局部 `verified-user-full-fill1-rclt-completion.json`；没有重跑其他22项或整套源码检查。

## 4. INBOX / 既有业务 / 条件保护

独立读取实施 baseline 文件，并观察完整 WXML 的实际 action 属性和分支祖先条件；独立脚本不执行业务。首次 XML 解析观察工具未规范合法无值 `wx:else`，在 baseline line20失败；规范该语法和观察用属性转义后完成一次有效检查。产品未因此改动。该观察器错误与实施者曾有的分段闭标签错误不同，均不是微信编译失败证据。

| 保护项 | 独立结果 |
| --- | --- |
| INBOX 旧完整前缀 | 仅逆除 root 模式 class，11,485 B恢复旧字节，SHA `2d894789f70c2174044a0191a4cd940c8dec44f0a64d595f446db706b58cb7f4` |
| 旧完整 CSS 前缀 | 33,781 B逐字节相等，SHA `4473440860e25493bd4875a6515dce0b421e5a5a2fa06f36a8d2083e4541ad65` |
| JS / JSON | 与基线逐字节相等，未改变 methods、状态、generation / identity 或接口 |
| 实际 action 保护 | INBOX22（21 bindtap + 1 bindinput）、CENTER19、CHAT4，旧 / 新 tag、bind / catch、data-*、disabled、id / aria-label、全部 wx 条件 / 循环祖先的多重集合相等 |
| source 新工具 | 无新增 bind / catch，input / attachment / emoji / voice / 3工具共7项关闭控件保持 disabled |

CENTER 原审批 CTA顺序按源调整为通过在前 / 详情在后，因此独立证明对实际 action 与祖先条件做完整多重集合比对；不伪称所有页面的 DOM 动作顺序逐字节相等。各动作的 id / version / 条件完整保留。INBOX markup和旧CSS本身的字节保护已单独证明。

手读既有 JS 对应前置条件并与 WXML 当前数据属性核对：

- `setFilter` 仍为 ALL / ACTIVITY / INTERACTION / SYSTEM allowlist，真实 identity / READY guard；没有把原示例2 / 1当未读数。
- `markAllRead` 仍校验 generation / identity、READY、真实 unreadTotal 和 in-flight，调用原 `/me/notifications/open-all` 后刷新并只在当前请求显示实际结果。
- `approveRequest` 仍按当前真实 registrationId / expectedVersion / canApprove 审核，原 `/registrations/:id/approve` 与 in-flight保护保持；`viewApproval` 带真实 eventId / isHost进入同场 host / cohost section。
- `openNotice` 按当前通知集合匹配 id / kind / event_id，使用真实 actionSection / kind映射进入同场活动详情、签到、报名最新安排、结项或个人处理记录，再走原通知已读链路。没有假名额 / 群聊 / AI代约动作。
- `copyReminderVenue` 仍要求当前身份 / request generation、CONFIRMED报名 / accepted_version、同一 event version / 合法活动状态及审核，从实际 city / venue复制；控件真实写明“复制地点”，没有冒充地图导航启动。
- CHAT4个实际绑定保持 `backToInbox`、context / closed explanation 两个 `goMyActivities`、`openNotificationCenter`；前者恢复真实 INBOX / 五Tab，后者进入真实 moments `filter=all` / CENTER。其余closed composer不会保存或发送内容。

上述只证明源码前置条件和绑定保留，接口成功 / stale / navigation 实点要由 root 运行其限定 SDK 路线。

## 5. 真实数据 / 关闭态 / 图片差异

N1 仅从现有 `centerItems` / approvals 投影真实标题、摘要、时间、未读和单个报名申请。原 source mock联系人、申请头像堆叠、示例时间、12 / 12名额、fee ¥45、fake payment / map / AI日程功能没有引入 R1。不存在费用通知契约时不制造费用卡；通用真实通知仍显示既有 standard分支。

位置卡保留源96px结构，但显式“位置预览尚未开放”；真实 CTA查看最新活动安排。Alex 继续显示 `CHAT_UNAVAILABLE`，无“Alex”虚构身份、在线绿点、示例消息、reaction数、快速发送及通话动作；从原 transcript恢复的是外层视觉和关闭说明容器，不是开通私聊。

两屏场景继续用既有 `/assets/stitch/caper_home_badminton.jpg`，56,146 B，SHA `df87413d3555b9f9b7cb7428a23ad2cbe1dad270fade6f53867ab29e29f2647d`，均明确“示意配图”。此文件不是 N1 / Alex 原始照片，也不是当前活动真实场地证明；图片替代是明确未达到原图相同的边界，不能由元素size和outline相同推断全PNG相同。

PG02-N2未新增独立route / selector /切换器，不计为本批实现或验收；本报告也不审 N2。

## 6. 证据与下一步

独立完成的源码 / 字形观察证据在 `/private/tmp/caper-wave69-messages-independent/`：

- `independent-provenance-and-binding-review.json`：冻结、保护字节、每mode action属性 / wx祖先条件、23项 subset / SVG轮廓、首遍full路径观察；其中 FILL1 full 未应用 rclt 的初始 false须与下一局部文件共同解读。
- `verified-user-full-fill1-rclt-completion.json`：full有效feature / substitution链、最终完整path和产品shield相等结果。
- `source-protection-review.py`：只读观察脚本，未作为产品测试或原生compiler。

23新SVG原始共16,657 B；实施者原源码 / 资源净增43,560 B不是编译包节省 / 占用实测。root负责一次必要preview与2MiB门槛、CENTER真实数据 / CTA /审批 /复制路径、Alex禁用工具和返回的定向SDK / 实际截图、最终提交。无需因本独审无新产品问题重复已完成sourcechecker或扩到全量测试。

### root 后续限定 SDK 新发现的滚动修正边界

完成本独立来源检查后，root 实际 SDK 从已滚动 INBOX 点击 `.center-entry`，CENTER 继承 page scroll，filter top73.5 被页头54..110遮挡。既有 `openNotificationCenter` / `openPrivateChatPreview` / `backToInbox` 未重置滚动；这项真实运行观察比本报告只读的旧绑定 / 代码保护结论更强，不能用 JS 未改反驳实际缺陷。

root 随后只在三个现有 mode `setData` callback增加 `wx.pageScrollTo?.({ scrollTop: 0, duration: 0 });`。独立读取这三个方法，identity guard、displayed参数、filter / search状态、Tab hide/show 和CENTER加载approvals前置条件保持。仅逆除3处完整callback后，新JS逐字节恢复 root修改前文件；修改前又与owner baseline逐字节相等。原始30,759 B / `799d2a61…`增加213 B，最终JS为30,972 B / SHA `5815366a2033852089afba3a7bff08e8869d8249a5457aee057b131c6cc74a4e`；所有其余业务字节保持。此新增运行修正单独覆盖owner protected JS最初freeze，不能把最初freeze未改JS的结论当最终JS hash。

局部证明 `/private/tmp/caper-wave69-messages-independent/root-three-mode-scroll-reset-local-review.json`，1,227 B，SHA `e4bb8ca66ea61658a058a3ce21ea023b51b358d149b9460e879ee7edc522f4eb`。没有重跑原sourcechecker、23glyph、35freeze检查或业务测试。

读取 root 的 `/private/tmp/caper-wave69-messages-scroll.json`：记录最终PASS、5个成功断言、exceptions[]；CENTER header54..110，筛选top170..198，未遮挡；CENTER返回、CHAT进入和返回的实际scrollTop0。root报告 Node --check通过。SDK由root运行，本审查者只读取结果，不声称自己重跑SDK / 微信 / 真机；本结果是局部3mode修正证据，不替代原8项动作或生产验收。

独立临时证据冻结：

| 文件 | 字节 | SHA-256 |
| --- | ---: | --- |
| `independent-provenance-and-binding-review.json` | 74,846 | `e83630da11f8664d5fb02ee3d3d65d9b1813aaaf5454429123a09d3317be6feb` |
| `verified-user-full-fill1-rclt-completion.json` | 1,769 | `b8f1e852daa40caf4555ee3c67bbb767411334637d1dab7280c5945b6468f674` |
| `source-protection-review.py` | 7,262 | `6e494c953ae46588d5b7d54f3e135fe6b4e56ba4dd2502a60b9e6af9fb6b6fcd` |
