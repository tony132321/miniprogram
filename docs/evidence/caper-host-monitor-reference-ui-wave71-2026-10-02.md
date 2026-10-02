# Wave71 `_5` 主办只读看板：来源与实施冻结

## 范围与真实入口

仅新增 `hostMonitorSection`。READY 的当前真实主办方在原更多菜单第三项“只读实时看板”进入；原举报、复制及完整 `stillCurrent` 保留。直链须回读同一请求活动且当前身份仍为真实 host；协管权限不授予看板。新返回按钮回 `hostSection`，失去当前 host 上下文则回详情。没有新增服务端 API、写操作或自动同步定时器。

基线：Wave70 `81ab6a794f32367c10c329297128bb96b131d599`，docs follow-up `d78b2464b4c97a17ddf4f0c13dc692ae892ba250`；immutable `/private/tmp/caper-ui70-immutable-illt8q2z`。原产品的 PG01/PG04-S/PG05/PG05-S/PG06/PG07/PG08/PG09/详情以及 generic 所有旧模板、业务和 CSS 前缀均受逆除保护。

## 完整原稿与准确资源

读取并保留 ZIP 内实际目录 `_5` 的完整 HTML/400×1600 PNG。原 HTML 25,760 B / `e2a2ce2fb2266283f7762dca23592c732eca385d88ce1772f1e22a41bec8b024`；完整原 PNG SHA 见配套 JSON。ZIP 来源 `/Users/tsb/Downloads/stitch_design_system_generator (2).zip`，24,668,856 B / `df22e733d33fda20979b75b8a7bc94717c4a5c9e41561a54e3038432fab32603`。

原两个同 family 的 Material import 中，后置 `wght,FILL@100..700,0..1` face 生效。复用已留存官方原 full v374 / Version2.972：WOFF2 1,136,920 B / `77f9711f3f896a1d7a34ab95cffc45cfb17d84c223f197c1b90faa0d043006e9`；decoded TTF 3,200,992 B / `cf46fa438e9ce2265958fdea4498c31ae5b7b39cb172ebff4f6aedb5aedcbc90`。该 face 可变轴只有 wght100–700（默认400）和 FILL0–1（默认0），opsz24/GRAD0 固定。14 原 span 消费者形成11种准确轮廓；3处 check 实际700，sports_tennis/verified 的 FILL1 应用实例的 active `latn rclt`（sports_tennis.fill / verified.fill），不是仅导出原 ligature base glyph。11 个 runtime path/color/viewBox/GSUB 均和 fullface 逐一匹配，Unicode、原节点、颜色、源字节/响应与复用路径见 runtime manifest。

7 个新 SVG 共5,828 B，4个 SVG 复用已存在的准确 back/person/verified/auto_awesome。原地图 PNG 152,683 B / `8c4881b9d74ec892c8549613ab1426b0a11c54793cdb073ffd6540c2805d02f4`，与旧详情地图不同，原响应字节准确放入活动分包 `assets/hm-map-illustrative.png`；明确标示原稿位置示意，不是本场坐标。源6张虚构成员照片未下载/复制。Material license 复用 `docs/licenses/material-symbols-Apache-2.0.txt`；完整字体二进制仅存在 docs/临时来源，不进入小程序，不新增全局字体。

## 有效 CSS px 与原生适配

| 原角色 | 恢复值 |
| --- | --- |
| header | 56px 内容高；side16、back44/−8/glyph24、title17/22/600/−.17、person32/glyph18；原blur24/custom shadow |
| 页面与标题 | side16/bottom24+safe area、卡间12；intro mt8/gap4、20/26/700/−.3，badge4×10/gap6/dot8/11/14/700/−.275 |
| hero | p12/r12/shadow-sm；22/28/700/−.44；128/112px ambient orb + blur40/24；sport48/glyph28 |
| 四统计槽/进度 | 四列gap12、p8/r8；数字20/26/700，标签11/14/700/.22；进度10px、700ms ease-out |
| 条件与 AI | row p10、circle24/check16、右margin8；headline17/22/600；AI orb28/glyph16、spin9s，body15/24.375；未定义shadow-xs不自行补值 |
| 名单 | avatar40、row p10/r8、inner gap10；真实 host 名称及右状态700，其余成员600；py-0.2无有效值，保持0 |
| 地图/末尾 | map128/r8/mt8、scrim black60、overlay p10；footer pill8×16/gap8，pt4/pb8；未知shadow-xs不补阴影 |

源 `main>:first-child` 清的是 main 直接子层的 margin，而 intro 是嵌套子层，其原 mt8 保留。所有新增源尺寸使用 CSS px/100% 响应式宽度；原 fixed header 转占流的 native sticky header，复用既有 statusBarHeight/headerPaddingRight 状态栏与胶囊避让，不缩小整页字体。AI headline 使用明确 class；统计绿色使用足够 specificity，避免灰色末行覆盖。

Plus Jakarta Sans 原400/600/700/800 faces 复用；未声明 profile500 alias、新字体或900。原 pulse2s与orb spin9s只是装饰，文案清楚为只读快照/功能未开放，没有“执行中”业务断言。

## 真值映射与封闭能力

统计用服务端 confirmed/reserved/requested/waitlisted 及真实 min/max；reserved 独立于 waitlist。整数/边界不合法时整个 projection 为 null，不把未知替成0。容量用实际确认数；进度视觉宽度上限100%，可见计数不修改。成局最低人数、主办场地声明、审核/风险安全状态独立展示，达到基准不替代原工作台人工成局。

原48小时/24小时警戒、15秒同步、恒温22℃、天气预警、T-2h 自动提醒、预付/AA支付、场地锁场订单号、假终端ID/云同步成功均不作为实际事实。保留源容器/图形/字号，分别标“尚未开放”“主办方声明”“付款未由平台核验”“原稿示意图”。名册只绑定 existing confirmedRoster 的授权昵称/匿名 glyph、真实 statusLabel；名单加载/空/错误分别可见。

## 针对性证据与旧区域保护

先写唯一新测试文件后实现 JS；旧基线 RED 6组中2过/4个预期功能失败，随后 GREEN 6/6、exit0（70.940209ms）。只运行 `test/miniprogram-event-host-monitor-navigation.test.ts`，未重跑旧测试。6组覆盖：真实host菜单/返回；member/cohost/visitor及不完整身份拒绝；directURL请求活动检查；10种陈旧 actor/session/id/event object/version/currentUser/loadState/refresh generation/host flags/hostId 回调拒绝；真实 refresh/onShow 权限丢失和不可用统计清除；旧举报/复制/工作台返回契约。native/API doubles，不是微信、实际 API 写入或设备证据。GREEN 原工具结果保存；RED结果为原工具回读摘要，没有伪称已保存 raw RED 日志。

首次且唯一限定 source/asset/binding/保护检查：82/82；没有跑全量、旧checker、SDK或CLI。完整 JS 14差异逆除→104,041 B / `97e9f505d58b4b10e4d74d0e360954a0bac4730e1ddbef3437efeba6ed17621e`；完整 WXML 3差异逆除→160,928 B / `69b231e3f4d506d2e3d46653bf9075e4ebaa69cdd06bcaf9b82b89d9c8fffa31`；旧194,503 B CSS前缀 / `d26cb609e200446af02965b5840bf1fe0f01f21b66e8841da6289022e6881ce0` 相等；JSON及所有旧 event assets 同字节。原更多 stillCurrent 整块保持；新体无业务事件/input/form/付款操作，仅新header的旧goBack/jumpToSection两绑定。

根已提交的 QR require、PG09/PG04-S/PG01/itinerary 照片分包引用，以及 pgd-state-primary 原生状态色修正均以 immutable70 为基线原字节保护。未覆盖根迁移。

## 冻结与后续运行入口

| 文件 | 字节 | SHA-256 |
| --- | ---: | --- |
| `event.js` | 106,348 | `85db2c73f3b832944782f8913a1ee9cf3a2d4468b54b4ea709e108c76ab26634` |
| `event.wxml` | 172,013 | `c23f5ee9f7b9d3238d6597fcf92ef18ff69bd9615e601d65261afeba3dc18680` |
| `event.wxss` | 206,812 | `a62ec5123dcf1a4866023d83571a06968fae3377c8e374b19044ca874e2b26b8` |

11个小程序产品路径（3页文件+8资源），另1个新测试，共12个 code/asset/test owned paths；protected JSON不计修改路径。小程序源净增184,212 B（JS+2,307 / WXML+11,085 / CSS+12,309 / 资源+158,511）；新主包资源0 B。实际编译包字节由根后续门测，不把 source字节当编译大小。

最终 manifest `/private/tmp/caper-wave71-host-monitor/frozen-owned-paths.json`，隔离产品副本 `/private/tmp/caper-wave71-host-monitor/frozen-product/`；配套 JSON 列全部路径/hash、来源检查、权限条件和 selectors。实际入口是原更多菜单 index2；运行选择器 `#hostMonitorSection`、`.hm-native-back`、`.hm-native-person`、`.hm-stat-grid`、`.hm-conditions`、`.hm-roster-list`、`.hm-map`、`.hm-terminal`。根可复用现有实际 approved host 活动进行只读验证，无需新增记录。

当前结论仅为本范围来源、静态保护和新局部行为测试通过；微信原生渲染、路由 SDK、编译包门及总体验收由根负责。本 owner 冻结后不动产品，等待独立审查。
