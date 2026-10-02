# 消息 INBOX 普通长页原稿恢复：Wave 74 M

日期：2026-10-02。执行 `docs/superpowers/plans/2026-10-02-discover-and-inbox-ordinary-long-pages.md` 的 M 范围；基于此前只读长页审计。只改消息页普通 INBOX WXML、追加该模式长页 CSS、两张原 inline SVG 与本页来源／证据。JS／JSON、INBOX header／priority／搜索／真实审批与身份状态、整个 CHAT／N1／N2、旧 CSS 前缀与所有既有素材保持。没有 Git、微信 CLI／SDK、配置、共享字体、总矩阵、全量或 CI 操作。

## 1. 输入与一次原 CSS 观察

原输入是用户 ZIP 中 **caper_3：`耍起 CAPER - 消息`**，不是 caper_4发现。完整原 HTML 与 PNG 已阅读／查看，四源 ZIP 原字节关联沿用只读审计的 `source-current-inventory.json`。HTML32,137 B／SHA256 `18fab22c6b92592673e19574739eb2ed86cbfb0fe628023ec5dcd3b843a1aa6b`；PNG210,560 B／`85fc42cb05ea57b3afe81c594917572ead3122dfa5feb958595574fb5901da1b`。PNG290×1600为缩小长图；CSS数值取原声明／级联，不从截图倒算。

本批仅一次原始 HTML 的 CSS 级联观察，共 **48个具体 source角色**，源码及结果在 `docs/design-sources/caper-inbox-long-wave74/`。复用已保存的 Tailwind CDN JS，阻断所有其他外部请求；没有 product投影、原生执行、图片／字体下载或样式镜像测试。原 CSS两份完整缓存和 hash可由 `source-css-observation.json` 追溯。

观察纠正了前只读表格的粗略行高：原 `text-xs` 实际 **12px／16px**，不是12／18；arbitrary11px实际16.5行高；AI `text-xs leading-relaxed`实际12／19.5。本次实现采用实际级联。原 `py-0.2`未定义，vertical padding0；`shadow-xs`／`shadow-2xs`未定义、实际none；没有给它们发明数值。

源 body font-sans 为 `-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif`。本批长页沿用这个系统栈；原handwriting配置Comic Sans MS／Chalkboard SE在这段没有实际可见class消费者，未新增Jakarta／Caveat或字体资源。系统字体与原生emoji的像素仍须真实绘制验收。

## 2. 恢复的 source 组件与真实闭态

| 组件／原 HTML | 本批准确恢复 | 实际数据／功能边界 |
| --- | --- | --- |
| 最近会话127–216 | p10／r16白card；源row p10×6／gap12／r12；44px圆头像；title12／16／700；tag10／15／p0×6；摘要12／16；源hover slate50 80%＋150ms颜色transition | 保留单一闭态行、信封而非假Alex头像、当前“私聊未开放”；保留唯一原 `openPrivateChatPreview`，不添加人物／私聊记录／时间／未读数。额外真实跳转按钮保留，不冒充源read-check图形。 |
| 真实通知分组273–311 | source白card p12／r16／边1／shadow-sm；heading12／16／700、图标14／20；实际各item p10／r12／slate50 70%／边1／gap12；icon32px＋16px原glyph；title12／16、time10／15、summary11／16.5／500、helper11／16.5；item gap10 | 原3组与所有记录完整保留。仅 `REGISTRATION_APPROVED`映射绿色原人群、`MATERIAL_CHANGE`映射粉色原地图；前者仍属于原INTERACTION，未挪组。其他kind继续真实badge／tone／title／summary；`externalHint`及真实提醒／补记按钮保留。没有固定2条／8/10人数／虚构地点更新。 |
| AI卡314–352 | 原indigo900→slate900→slate950；p14／r16／shadow-md；128px光晕right/top−32、blue50020%／blur40；原40px外渐变p2＋内slate950＋10px lime圆点，pulse2s／原cubic(.4,0,.6,1)；标题12／16、tag9／13.5、copy12／19.5；按钮11／16.5／p6×12／gap8／mt12 | 原“没有AI对话与推荐接口”说明保留；唯一 `goDiscover`仍真实跳转。第二source尺寸按钮明确 `disabled=true`且无handler，文案“一键确认未开放”，没有批量审批／假推荐2／3或假AI服务。 |
| 提到我356–378 | p12白card／r16；@14px蓝、header12／16；row p8×4／gap12；40px匿名@circle、body12／16 | 只说明群聊／提及／私聊接口未开放；没有Luna／提及消息／假时间。原“全部”位置为只读“尚未开放”，不增handler。 |
| 相册382–432 | 源五槽 **96×64px**／gap10／r12／p4，emoji18／28置底居中；五个准确to-top-right渐变；title11／16.5／700／mt4、note9／13.5／600蓝 | 保留原现有四个灵感名称，补第五日落装饰槽；明确“灵感示意／非真实活动照片”。原没有img；新增图片0 B，不显示原12／8／15／9／11张假计数，也没有相册API。附加服务说明与source额外间距边界明确，不声称整PNG同内容／同高度。 |
| 历史436–465／结束469–486／归档490–510 | 恢复三个源p12／r16组件与heading；源row p8×4／gap10、32px／r8原emoji标识、title12／16、description12／16 | 新增的仅只读闭态组件，分别明确记录接口／会话／归档免打扰尚未开放。没有把通知OPENED当归档／已结束会话，没有登山队、读书会、聊天摘要、日期或mute写入。 |
| 品牌横幅514–527 | p14／r16／borderblue10070%；blue50→indigo50→lime50；title14／20／900／tracking−.025em；helper11／16.5／500／mt4；贴纸p6×8／r4／9／11.25／900／rotate2deg／shadow-sm | 品牌文字继续静态，无新业务；源外框shadow-2xs实际none。 |
| 设置531–540 | p12／r12／边1／无shadow；原bell14／20、gap10；inline title12／16／700＋父16／24首行盒；block helper10／15／400；右符号12／16／700 | 唯一原 `goNotificationSettings`与既有说明保留；不伪造push已授权、手机号或已开偏好。 |
| Footer543–550 | margin-top16／pt16／pb8；上9／13.5／900／tracking.1em／uppercase；下10／15／700／mt4，两条24×1px slate200线／gap8 | 保留现有真实品牌tagline；新增仅源装饰，无功能入口。 |

各长页组件 gutter 采用 `calc(16px - 26rpx)`只抵消旧外层26rpx，从而保持 source16px边距；没有改外层 page、已恢复header、priority或其他模式尺寸。source main pt4、固定390外框与实际微信窗口／R1额外搜索／计数／加载／服务说明的完整首屏像素仍属平台／内容适配边界。

最终手动自查发现原 Tailwind preflight统一border-box：新增conversation-row的width100%加横padding时必须明确相同box-sizing。本批仅补这**一个纯CSS声明，+24 B**；`final-box-sizing-proof.json`证明唯一逆除恢复首次已检查CSS，WXML／业务／资源无变；未重复71项检查。

## 3. 两张准确原 inline SVG

新运行素材只有 **618 B**：

| 文件 | 原 HTML | B／SHA256 |
| --- | --- | --- |
| `pages/messages/assets/wave74-inbox-people.svg` | 285行：绿色圆中的完整人群children | 364；`73eb0f340370629c4852237533cea9751888524a15b085e42b6f9c94f5f8adc6` |
| `pages/messages/assets/wave74-inbox-pin.svg` | 299行：粉色地图children | 254；`4fd6d2c2fb7de30ec688d4fec4b27d67c6e9b84a2b2aa77a9154ce88b3c22e50` |

原child XML逐字节保持，不重画／换家族／简化／四舍五入。独立root仅补xmlns、16×16px、正确viewBox0 0 20 20与源继承fill：emerald600 `#059669`／rose500 `#f43f5e`。前者source有一条path，后者保留原clip-rule／fill-rule evenodd；完整children与hash见 `inline-svg-source.json`。

来源为用户提供设计包；未附此inline的单独外部许可证，未擅自标MIT／Apache。没有Material／Phosphor或字体依赖，也没有新照片／fontface；旧34个资产包括N2照片及glyph保持byte。

## 4. 一次必要保护与资源检查

首次联合检查 `/usr/bin/python3 docs/design-sources/caper-inbox-long-wave74/check_source_protection.py` exit0，**71项必要来源／资源／旧区域保护断言通过**，没有样式镜像或业务测试。

检查器首次对已有WXML的raw `&&`与boolean `wx:else`没有XML归一化，分别在原baseline解析时失败；只改harness归一化后完成这次联合检查。未因此改变产品、不当作UI产品失败、未隐去辅助诊断。源码／输出在 `targeted-source-protection-proof.json`。

- 全部 **63个现有动作节点**（62个唯一合同）保持handler、data、id／disabled／value／placeholder／aria与有效wx祖先。普通长页实际受影响6个：私聊闭态入口、真实notice row、真实签到／补记子按钮、loadMore、goDiscover、goNotificationSettings；受保护priority另2个不计新功能。
- 全WXML逆除14个表现替换精确恢复原 **34,914 B**／`69208a8ae7b49fef663ac51ef723f45248959b29aa0c3ad649507d174c0c1e13`。
- 整个旧CSS **67,613 B**／`2b8787c83c01314c1a23b5d2549984c251e842180cd8206ee4553304f3907c7a`作为完整前缀保留。新增普通selectors均以 `.messages-inbox .inbox-long…`限定；只有唯一新名pulse keyframe。没有裸card／hint覆盖，更没有字体全局修改。
- INBOX header/status/root2,045 B／`76efec156b5fe127a4637bd4b8fc4da19d36b0e0c75f8b03255adc4a170bb36a`；priority1,043 B／`ac00ab004cd980dec42a30f024b67a546a61292ddc3c7e96a58d76bf114dfcd2`；搜索／异常／身份／加载／审批／empty整段与原一致。
- 非INBOX整个suffix **23,282 B**／`c38173522a35fefec876eab293b7e25db1e6d70019d9952462857cd8fde6025f`完全一致，涵盖CHAT／N1／N2。
- JS **32,969 B**／`b297f95f560581abc5718b4fe35cb66453601f1e0948e6940800e4eb8e10a8c0`、JSON63 B／`b76e69c65eadf25397e0df5c9457c5a098c1bfc714ae05be5441318bdc8ebacc`与34旧资产逐字节一致；无后端／API／身份／session／generation／hide／stale callback行为变化。
- 两个SVG可解析、root尺寸／paint与child原字节准确，各有真实kind条件引用；运行资源新集合仅2个SVG。新source二级AI按钮唯一、disabled=true、没有handler／data写入；没有新增网络图片URI。

63节点不是63次实际点击，也不代替真实通知API／审批／微信字形或动画通过。根代理限定原生点击与source绘制另行记录；本批没有重跑N1／N2／CHAT、前批布局／字形／整套业务或CI。

## 4.1 独审的三类最小修正

收到独立 reviewer ui64_review 聚合清单，已按 receiving-code-review 技能直接核完整原HTML与旧级联；root明确授权后仅改新scope三类表现：

1. 原source292／306行 `<p>`不含truncate；仅新notice summary增加 `white-space:normal; overflow:visible; text-overflow:clip`，清掉旧42行nowrap／ellipsis继承。保留真实summary与handler／kind／分组。
2. 原505行归档helper是 slate400 `#94a3b8`；只给既有 amber图标邻接的归档描述修正，历史／结束两卡仍slate500 `#64748b`。无新数据或归档功能。
3. 原535／536是 inline span12／16标题＋block10／15helper，父16／24匿名首行盒。仅原“消息通知设置”title改专用inline text，并恢复父16／24、helper明确block；不写死原CSS-only观察65px，不动唯一goNotificationSettings。WXML＋67 B、CSS＋210 B，合计＋277 B。

`review-source-correction-proof.json`记录每段old／new和独立局部inverse：新两文件逆除这三类精准回到首次freeze WXML `6e0c3b…`／CSS `f9eff614…`；旧CSS67,613 B完全保持。SVG／JS／JSON／headers／priority／approval／CHAT／N1／N2无变化。保留首次71项和48source观察，**没有重跑**完整checker或runtime。私有修正脚本的首轮检查沿用了reviewer少1行的source行号，在写产品之前失败；仅将私有检查定位到实际292／306／535／536行后继续，产品与来源原字节不因行号差误改。

闭态会话tag采用中性灰而非原示例紫色角色tag、只读 mentions不设clickable hover，是现有R1不可用状态的有意边界，不声称这两处paint／pressed完全与原可用示例相同。

## 5. 最终冻结与净字节

| 产品路径 | B | SHA256 |
| --- | ---: | --- |
| `miniprogram/pages/messages/messages.wxml` | 38,796 | `db32d3f3a4061d472f579953efdbe4fd5af71ae8af5e5e4c5fb171f141ac4dd7` |
| `miniprogram/pages/messages/messages.wxss` | 82,556 | `ca8454e7cc3e9f8892d14fbf9a5c5ac79517db8c4045222012c14e54456b6a89` |
| 两个新SVG | 618 | 上表各hash |

应用原始净增 **19,443 B**：WXML3,882 B＋CSS14,943 B＋SVG618 B；新photo／font0 B。这不能推定实际微信编译包通过2 MiB；root最终preview统一测量。

源／实施的4产品路径及13独占source路径、本证据一并列入 `/private/tmp/caper-wave74-inbox-long/frozen-owned-paths.json`，并保存 `frozen-product/`完整相对路径副本。完成freeze后交独立来源审查；自己的联合检查不算独审。3类独审来源差距已经下述局部修正；剩余是：该delta独立复核、root本页新增长段原生绘制／6动作与实际same-ID按钮、最终包门与GitHub提交。未声称整长图像素完全相同、无假source例子落地，未声称项目完成或真机／正式环境资源已经通过。
