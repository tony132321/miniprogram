# CAPER 首页状态原稿接入 — Wave 70

## 范围和冻结

基线 `b45a99d0749fd1c4a14f88fa588b244b6a844a4d`。本代理仅修改 `miniprogram/pages/index/index.wxml`、`index.wxss` 与新的页内资源；没有修改业务 JS、JSON、共享字体、配置、矩阵，也没有执行 Git、微信 CLI、SDK 或全量测试。

独立复核修正后的产品冻结清单 `/private/tmp/caper-wave70-home/frozen-product-reviewed-complete-paths.json`：17528 B，SHA256 `549c9011a08f983a8fa5435db28eb3630628f19f99b8c7d8402a2d66c5407985`。44 个同字节产品副本位于 `/private/tmp/caper-wave70-home/frozen-product-reviewed-complete/`，供 root 定点样式补验。

初始冻结清单 `/private/tmp/caper-wave70-home/frozen-product-paths.json`：17,157 B，SHA256 `8fe1db5a4fe3c709261d8ac310c398a0b9079de246f8deb2fcefcc1724d345b2`。初始 `/private/tmp/caper-wave70-home/frozen-product/` 副本完整保留，为 root 先行限定 SDK 的输入边界；未将后续 CSS 修正冒充为该次运行的版本。

| 产品 | 字节 | SHA256 |
| --- | ---: | --- |
| index.wxml，复核修正后 | 38,653 | `b972b559a2c523f2b1c7ca794023595fe6fee94a90add1527a3ef1cce7204c81` |
| index.wxss，复核修正后 | 86,165 | `27b11080f2eb16d8a2280567b697a3edd0d7af3e4158bc341d7a44146dcd0cea` |
| index.js，保护 | 32,598 | `d85b9db816163c4853bd2a7a9abec66dc62e8047d9e79c19457f4cb57dc8ac11` |
| index.json，保护 | 143 | `a082db2fcb674d4131b60f427fcb40891d00e1d2571e372df9827fa25e2f1fb1` |

## 原稿与实际显示

完整阅读并实际查看 PG02-B、PG02-C、PG02-D 的 HTML 和 PNG；六个原文件与用户 ZIP 中对应 entry 逐字节相等，见 [来源证明](../design-sources/caper-home-states-wave70/source-original-proof.json)。原稿完整 HTML、各节点资产清单、字形和下载原图证明保存在 [来源目录](../design-sources/caper-home-states-wave70/source-manifest.json)。照片不是当前真实活动的摄影记录，页面沿用明确的“配图为活动类型示意”说明。

新增 `.home-state-reference` 仅作用于 pending、organized、history，分别带 `.home-state-pending`、`.home-state-organized`、`.home-state-history`。卡片新增 `.home-reference-card` 仅匹配 REQUESTED、RECONFIRM_REQUIRED、WAITLISTED，已授权招募的主办卡，CONFIRMED／IN_PROGRESS 主办卡，以及 COMPLETED 历史卡。

| 原稿 | 恢复的来源结构和值 | 真实数据与关闭边界 |
| --- | --- | --- |
| B 待确认 | 48／32 px 原圆形机器人、三色横向渐变、原两处光晕；16 px 圆角、176 px 封面、28／28 px 英文海报字；17／22 px 标题、13／18 px 元信息；变更带与候补通知卡、原 12 px 操作圆角 | 报名状态、日期、地点、容量和按钮使用实际字段。旧新时间比较、候补名次、等待时间、假头像与自动推送承诺没有数据，未显示虚构值。B 三张场景图未加入 runtime，沿用明确的类型示意封面。 |
| C 我组织的 | 44 px 神经图形圆球、原浅色渐变；16:9 封面；来源 Good Game! 贴纸和准确图形；20／26 px 标题；四列间隔 12 px、22／28 px 数字；44 px 工作台、公告、分享／签到按钮；原底部圆章 | 人数来自已授权的详情统计；招募、审查、暂停、签到入口继续由既有 guards 控制。没有伪造微信群、参与头像或固定 8／8 人数。已成局／进行中按真实羽毛球使用授权的 C 羽毛球示意图，没有把骑行照片当作羽毛球记录。 |
| D 历史 | 原 135° 蓝紫渐变和圆形图形；176 px 历史封面；真实反馈卡 `.history-feedback-card` 160 px；原饱和度 .85／对比度 1.05、贴纸、17／22 px 标题、13／16 px 按钮；原 FILL 1 爱心和两根 32 px 装饰线 | 历史日期、状态与活动名称保留真实字段。只有既有 `primaryAction === 'checkinSection'` 的真实结项反馈卡使用粉色“结项反馈”标记，未断言尚未评价。没有显示虚构星级、照片数量、参加者名单、AA 人均额、已清算状态或授予勋章；相册继续为关闭态。反馈卡使用授权的 D 羽毛球图，没有将原野餐图当作羽毛球事实。 |

原内容 header 56 px，字面 px 值用于新增样式。native status／胶囊继续使用原 `statusBarHeight` 和 `headerPaddingRight` 真实几何；不会重画原稿的系统状态栏。原固定 header 语义由既有原生吸附 header 承接。原 16:9 用宽度 100%、高度 0、底部 padding 56.25% 表达。品牌、长日期／地点／状态和实际五个分类保留必要的原生限宽；原稿四分类没有替代真实“协办”分类。

真实 notes、快捷入口和额外统计继续显示，因此没有将原稿静态示例的卡片总高度宣称为每一条实际数据的固定像素结果。C 招募／已成局海报根据实际状态显示；英文 poster 内容沿既有分类数据，未伪造主办昵称或天气。

## 字形、字体与包体

40 个准确 SVG 共 32,262 B，来自保存的官方原后置完整 Material Symbols face，使用 FontTools 4.60.2、wght 400、FILL 0 或 1、固定 opsz 24／GRAD 0；路径没有舍入。FILL 1 的 `smart_toy` 和 `favorite` 均进一步应用实际活动的 rclt 替换为 `.fill`，没有只取原 ligature glyph。来源及完整 path／paint／hash 见 [glyph manifest](../design-sources/caper-home-states-wave70/glyph-manifest.json)。40 个变体对应的是实际用到的颜色；其中 `sourceNodes` 列出同名原节点候选，不能将某一变体颜色归给全部候选节点。

官方 full WOFF2 复用 `docs/design-sources/caper-activity-wave69/original-last-material-full.woff2`，SHA256 `77f9711f3f896a1d7a34ab95cffc45cfb17d84c223f197c1b90faa0d043006e9`；未向主包复制字体或整套图标库。没有改全局字体，也没有扩张专属 profile 500 alias。Jakarta 字重继续复用现有 400／600／700／800 face；原稿的 900 声明仍按原样保留，实际 face／中文 fallback 和换行须以 root 原生证据为准。

root 对真实包体问题明确授权仅接入 C／D 两张羽毛球原图：

| 来源图 | runtime 原字节 | SHA256 |
| --- | ---: | --- |
| PG02-C 羽毛球 | 50,486 | `127a013960fb752eccf0bc9e89146d60d6a3b5f12f67ccfbca1dc42e7c760dd0` |
| PG02-D 羽毛球 | 61,936 | `a02ca85ada6835044e0e2056cf231c71a744a4e93a83601e6a9abb93d73d8c6a` |

七张场景原图共 437,141 B；其他五张仅保留 private 临时来源，没有放入 runtime 或提交图片二进制。来源 URL、用途、字节和 hash 见 [photo manifest](../design-sources/caper-home-states-wave70/photo-manifest.json)。

复核修正后本批 raw 净增 **197,140 B**：WXML +13,946、WXSS +38,510、SVG 32,262、JPEG 112,422。初始净增为 186,836 B，纯表现修正额外 +10,304 B。原余量 103,963 B 加 root 的 PG09 图片分包迁移 70,223 B，静态相加仍小于最新 raw 净增 22,954 B；最终是否满足微信编译包体以 root 最终 CLI 为准，本代理未替换或压缩原图、未改配置／共享资源。

## 单次相符检查

完成一次限定 source／assets／binding／protection 静态检查，**93 项断言通过**。见 [实际检查输出](../design-sources/caper-home-states-wave70/targeted-source-binding-proof.json)。最初未完成的 checker 因错误要求 root selector 尾随空格而自行拒绝，修正匹配器后完成；该次没有引发产品改动。

- 原 62 个实际动作节点的 handler、data、aria、输入参数及完整祖先 guard 相等；22 个真实 handler 仍存在于未改的 JS。
- 26 处纯模板投影逆除后完整 WXML 恢复 Wave 69 原字节；47,655 B 原 WXSS 为完整前缀。普通首页第一段／长页、下半页完整原 substring 保留，全部旧页内资产原字节不变。
- JS／JSON 字节相等；新增 selector 仅在三状态 scope 中，没有 rpx 或 profile 500 alias。协办使用旧 banner 分支，不命中新状态 scope。
- 40 个 runtime SVG 的 path／paint／viewBox／hash 等于对应来源记录；两张 runtime JPEG 与下载的来源原字节相等。不存在未引用的新资产。
- 所有真实分类计数、活动 ID、容量和四个主办统计字段仍绑定；没有新增静态人物、评分、候补顺位、等待时间、AA 清算或自动推送成功值。

该检查不运行 API／业务逻辑，不等于微信渲染、点击或全部 39 屏逐像素验收。独立源码审查和 root 的限定 SDK／CLI 证据另行记录；没有重复已有全量或样式镜像测试。

## 独立复核的限定修正

独立 reviewer 聚合给出八组准确来源偏差；逐项核对原 HTML 与已保存的 Tailwind 3.4.17 官方 `config.full.js` 后，仅修对应表现。

- B 非选中 tab 恢复 `#f4f3f8`；C 选中 tab 文字恢复 `#faf8fe`。
- `tracking-wide` 为 .025 em，`tracking-wider` 为 .05 em：B tagline .325 px、C 成局海报 .275 px、C footer .55 px、D 日期和首卡贴纸 .55 px。C banner、D 海报标题的原 headline 自身 tracking 为 -.17 px；C 招募 pill 恢复 700，成局 600 保留。
- B 候补 badge 文字为 `#424655`；重新确认 tagline 为 `#d2f803`／700。
- D 真实反馈卡图片不加滤镜；右上 badge 恢复黑色 40%／白字、2×8 px padding，保留原 `backdrop-blur-md` 的 12 px 模糊且不显示第一卡的 green dot。仍显示真实 label，没有换成静态人数。
- C 首卡 `drop-shadow-md` 作用在白底 pill 外层，字体不额外重复 text shadow；成局／进行中分支不继承该影子。
- B／C orb 恢复双层 1 s ping；C 神经图形和 D 内球 2 s pulse；B REQUESTED amber 点 2 s pulse、变更 warning 1 s bounce、C 招募白点 1 s ping。原 keyframes、曲线与 150 ms transition 数值按官方缓存源码恢复，名称仅使用本批 namespace。
- 11 处纯 WXML 修改只增加动画子 view 和原生 `hover-class`。原动作、data、aria 和 guard 祖先不变。B banner .99，三稿 tab .95，B 取消／重新确认 .98／候补 .95，C 公告／分享／箭头 .95，D 真实卡片按钮 .95；原 active background 同时恢复。C 无效 `active:scale-98` 没有自行补值。B 当前选中 tab 未声明 transition，保持立即缩放；B 其他 tab、C tab、D tab 按原各自的 all／transform／all 处理。

见 [局部修正证明](../design-sources/caper-home-states-wave70/review-delta-proof.json)。本次仅逆除 11 个纯表现片段与追加 CSS：精确恢复初始 WXML SHA `791f7bb0…` 和 WXSS SHA `2d0e3411…`；42 个其余产品路径与 JS／JSON 字节保持。旧 93 项检查输出完整保留作为初始版本证据，没有重跑全检查或将它宣称为新 gesture／动画的运行结果。

## root 的限定按钮范围

header 消息／我的，构思 banner，五个分类，以及实际卡片的封面、主操作、次操作、已有快捷入口和主办分享，均保留原动作节点；数据来源是 `GET /me/events` 和已授权 `GET /events/:id`。

| 实际状态 | 既有目标和前置条件 |
| --- | --- |
| REQUESTED | `registrationSection`；可取消申请时次操作仍为 `pendingExit` → 同 ID 报名区域。 |
| RECONFIRM_REQUIRED | “核对变更”仍进入同 ID `registrationSection`；首页没有直接执行确认参加。 |
| WAITLISTED | 报名区域、规则与已有退出快捷入口；没有私聊或虚构付款入口。 |
| 主办，RECRUITING + APPROVED + recruiting | `hostSection` 工作台、`hostAnnouncement` 公告；`shareReady` 才能进入同 ID 原分享页。 |
| 主办，CONFIRMED／IN_PROGRESS | 管理活动和 `checkinSection&entry=hostCheckin`；两按钮恢复原灰／蓝 44 px 结构。 |
| 历史主办，COMPLETED | `hostRepeat` 仍先核对同 ID、当前 host、version、账号和 system safety；随后进入原同场 `hostSection&entry=hostRepeat`。 |
| 历史成员，COMPLETED + CONFIRMED | `checkinSection&entry=memberFeedback`；真实具备 AA 读取资格及详情 feeMode 时仍有 `expenseSection`。 |
| 相册、未匹配状态 | 相册关闭无 handler；额外安全状态保持既有真实动作、审核／暂停提示与中性取消／过期卡。 |

所有 ID 和 action 继续由 `openCardAction`／`openEvent` 的当前账号、items 列表与白名单核对；旧 canonical event 入口由既有分包入口兼容，不在本批更改。

## 复核末尾的三个定点常量

C 成局／进行中海报恢复原 `text-surface` 的 `#faf8fe`；D 反馈粉贴纸恢复原 `shadow-sm` 的 `0 1px 2px rgba(0,0,0,.05)`，右上黑色 badge 的无 shadow 保留。D 第一卡真实 `history-repeat-card` 的中性“AA 活动”标签恢复原第一卡 2×8 px、6 px radius、11／14 px、700、.22 px tracking、12 px blur；不声称已清算。反馈卡额外的中性 AA 标签没有源第二卡人均价对应，保持旧额外字段几何，不显示假金额。只执行这三处逆除，精确恢复此前 `dd1a1dce…`，再去除已有表现 delta 精确恢复初始 `2d0e3411…`；没有重跑原动作／字形检查。
