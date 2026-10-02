# Wave 73 普通首页长页独立来源审查

日期：2026-10-02。审查者：ui65_font_audit；实现者：ui64_discover_impl。先独审稳定样式 stage，后仅复核三类来源修正与11原图组件 / 根共享字体增量。未重复 owner完整checker、历史业务测试或SDK。本文件是源码独审，不代替微信运行验收。

## 1. 范围与冻结输入

依据用户 supplied `caper_2/code.html` / PNG 与 `docs/superpowers/plans/2026-10-02-home-ordinary-long-page-source-restoration.md`。完整原稿已读，PNG 已看；普通长页来源从 RecommendedDualColumn 至 Footer（HTML 259–720）。首屏、条件态 B / C / D、协办、邀请码、既有角色保护以完整 WXML 逆除与 CSS 前缀比较为证。

样式阶段 manifest：`/private/tmp/caper-wave73-home-long/stage-styles-manifest.json`，2,901 B，SHA256 `25a883e0ac96572392c017d247354517b51193b84daf617f1d0c50979fe1a596`。仅读取其 `stage-styles-product/` 快照，未把并发修改的 live 文件当作初始 freeze。

| 样式阶段产品 | B | SHA256 |
|---|---:|---|
| index.wxml | 43,633 | e219eda5981066ff0cb1f0f5e1ae81974f42b9bdb9c5ca13c36867e962fd5f22 |
| index.wxss | 106,789 | e74bdbf5c4f6c41c078ed1a79460dd0f4003f6d380beeb0b33923d2d92527013 |
| index.js | 32,598 | d85b9db816163c4853bd2a7a9abec66dc62e8047d9e79c19457f4cb57dc8ac11 |
| index.json | 143 | a082db2fcb674d4131b60f427fcb40891d00e1d2571e372df9827fa25e2f1fb1 |

原 HTML SHA256：`e4e4ba417711e27838f10cef098c4da8c428d3b9d7c4217fe36d9def5761c4ca`。源码完整副本与 34 角色 / CSS-only 观察在 `docs/design-sources/caper-home-ordinary-long-wave73/`。34 角色含 2 个原首屏字体参照；本轮不重做它们。已有原稿观察没有加载产品、更没有对产品写样式镜像测试。审查仅读取已有原 HTML、生成 CSS、投影与产品 CSS。

## 2. 独立读取的源角色

| 原角色 | 源值 / 实现对应 | 判断与边界 |
|---|---|---|
| 推荐双卡 | 2 列 / gap12；cover112；r16 / border gray100 / shadow-soft；内容 p10；标题12/16/700、日期10/15、底栏 mt8/pt8 | stage 对应准确；真实灵感副文案 / 主题示意替代虚构日期、人数、头像 |
| 品牌 banner | h176 / r24 / shadow-soft，p20；黑 .85/.6/.3 三段右向渐变；标题20/25/900 / tracking-.5；英文10/15/600 / .5 | `.from-black/85` 已有真实生成规则，未按无效 token 删除；手写16/24/700、rotate-3；☺ 保留系统字体 14/20/900 |
| 热门四卡 | 4 列/gap8；照片外壳80/r16/mb6/shadow-sm/overflow-hidden；label11/16.5/700；caption9/13.5；底部9/13.5/600/mt2 | 固定图框 / hover 结构初审存在第 5 节差异，最终已修；样例人数改真实闭态，不冒充实时热度 |
| 四主题 | 96 / p10 / r16 / border1；amber/sky/pink/emerald50 与100边；emoji20/28；label12/**15**/700；sub8/12/600/mt4 | 使用原有效 `leading-tight`，没有误算成 16；四 hover 背景为各100颜色 .6；过渡属性最终已按原声明修正 |
| 本人活动近况 | 横卡112 / cover112 / r16，gap10/pb4；标题12/16/700、日期10/15/mt2、状态10/15/600/mt4 | 与 source nearby 卡视觉对应，实际数据仍 `homePreviewItems`，不复制 source0.8/1.2/2.1km 或假报名人数 |
| 构思 banner / list | p12 / r16 / gradient blue500.15→purple500.15→pink500.15，borderpurple200.5，mb14；list p12/r24/shadow-soft，图48/r16，行p6/right56、gap12 | source absolute doodle 是 `space-y-3` 早先 sibling，所以第一行真实 margin-top12；保留，不改成0。手写16/16/700、right-8/top40/rotate4；hover gray50.6；过渡最终已修 |
| 拼贴 | 12 列、7/5跨度、gap8、h256/p4/r24；主图 bottom10/left10/right8，黑 .7→transparent 渐变；右侧双图50%和原 flex shrink；贴纸 max110/p10/r12/right-4/bottom-8/rotate4/shadow-lg | 字形18/22.5/700、贴纸 Nice14/20/900/tracking-.7、sub9/11.25/800；手写投影第5节最终已修 |
| 功能说明双卡 | width224/p12/r16/bgblue/emerald50 .5 /边100 .6/shadow-sm；copy11/17.875/500；quote12/12/400/serif；foot mt12/pt8/gap8/边100 .5，symbol28 | 不搬样例评价、头像、昵称、经历；使用已有真实功能说明与安全守则。字体和几何对应准确 |
| 城市 banner | h192/r24/shadow-soft/p20；黑 .9/.5/transparent 顶向渐变；title20/25/900、copy10/15/500/mt4；limeCTA8×16/rfull/12/16/800/glow | 系统字体标题 / Caveat 城市 label12/16/**400 请求**区分；原页面只请求 Caveat600/700，root 正验证600匹配；CTA保持已有 goCity、hover#b5e028，过渡最终已修 |
| final CTA | p24/r24/边gray100/shadow-soft/white→gray50；bulb40/r16/emoji20/28/mb8；title18/28/900/tracking-.45；copy12/16/500/mt4/mb20；button14×24/r16/gap8/14/20/800/原floatingshadow | source 不存在任意新缩放；native hover opacity.95准确。精确过渡最终已修 |
| footer | p8top24bottom；brand14/20/900/tracking-.35、CAPER9/13.5/800/.9；copy10/15/400；links10/15/500/gap12/mt12/hovergray600 | 真实 goAbout / goPrivacy / goSupport 保留，无新网络写入 |

统一 sans family 原声明 `-apple-system,BlinkMacSystemFont,SF Pro Display,SF Pro Text,PingFang SC,Hiragino Sans GB,sans-serif`。Chrome CSS-only 观察可把 BlinkMacSystemFont 归一到 system-ui，不据此自行换来源字体。四长页手写消费者分别 16/24/700、16/16/700、18/22.5/700、12/16/400 请求；共享 font 由 root 负责，不在此阶段宣称字形已加载。

## 3. 五准确 SVG 与 hover

独立直接从完整原 HTML 找原 SVG 字串，并解析实际 SVG child element / 每个属性 / text。五个实际产品 SHA 与 manifest 匹配；子节点几何 / stroke-linecap / stroke-linejoin / width 全相等。导出使用 XML 自闭合 path，原 HTML 为独立 closing path；这是序列化差别，不能写成 literal child-byte 完全相同。根只去掉 CSS class、补 xmlns、统一 viewBox 大小写并将 currentColor 解析为原继承颜色。

| SVG | 原行 | 尺寸 / paint | B |
|---|---:|---|---:|
| w73-refresh-blue.svg |266|14 / #1d64f2 / root stroke2|280|
| w73-chevron-gray.svg |363|14 / #9ca3af / child stroke2|185|
| w73-chevron-purple.svg |521|16 / #7e22ce / child stroke2.5|187|
| w73-plus-white.svg |696|20 / #ffffff / root stroke2.5|189|
| w73-chevron-gray-hover.svg |363|14 / #4b5563 / child stroke2|185|

合计 1,026 B，无自行形状 / 无 Material 代换。gray hover 原是父 `hover:text-gray-600` 的 currentColor；native 外链 SVG 无继承 paint，准确两资源由现有 hover-class 显隐互换。蓝 link opacity.8 / city背景 / footergray600均映射源有效 CSS。

## 4. 原绑定 / 保护范围

独立一次保护比较产物：`/private/tmp/caper-wave73-home-independent-review/stage-independent-source-proof.json`，14,349 B，SHA `abd693576892ba7d8c5e76cf30fe6d6f6a5d3c5c349c1864265e8f7a97dcb996`。

- 用初始 stage 自己的两段 bounded UI 范围（长页明确 BEGIN/END 与 footer）逆除，完整 WXML 精确恢复 baseline **38,653 B / b972b559a2c523f2b1c7ca794023595fe6fee94a90add1527a3ef1cce7204c81**。因此首屏 / W70 / cohost / invite 其余所有 markup 字节保持。
- 完整旧 CSS **86,165 B / 27b11080f2eb16d8a2280567b697a3edd0d7af3e4158bc341d7a44146dcd0cea** 是 stage 精确前缀；新增20,624B只在 ordinary `.home-long-reference` / `.home-long-footer` 后置范围。未改旧首屏 / 状态页 CSS。
- baseline 与 stage 的 **62 个 action 节点 / 52 个 unique contract** Counter 相等，包含实际 handler、data-id/title/key、disabled、value、placeholder、aria 及有效 wx 祖先（if/else/for）。未把 hover-class 当新业务行为。
- JS / JSON 见第1节 SHA，与 baseline 字节相等；未新建 backend、写入、过滤函数、账号守卫。
- 直接读现有 JS：`homePreviewItems` 来源真实账号列表，只取 RECRUITING / CONFIRMED / IN_PROGRESS 前3；`openEvent` 仍校 shownIdentity/currentIdentity、dataset ID 在真实 items 内，再到旧兼容URL；未改 source photo 为真实当前活动。
- `openInspiration` 仍 showModal 当前仅羽毛球可发起，确认后走 goCreate；非羽毛球不会预填假草稿。goDiscover仍已存在真实闭态；说明 / 安全 / 城市 / footer 均已有真实对应路由。

辅助脚本首次尝试用 live owner transforms 的 new literal 在初始 stage 匹配失败，因为 owner 已并发更新新组件/后来 hot-frame。只修独立读取脚本，用初始 bounded stage markup 独立逆除并明确保存 normalize 记录，产品未因脚本失败变更；该失败不是产品 defect，不算额外业务测试。

## 5. 一次聚合 source 差异与最终局部复核

1. **热门图裁切框。** 原 370 / 379 / 388 / 397 行：固定80px/r16/overflow-hidden/shadow-sm wrapper包 image；仅其 image group-hover scale1.05。stage直接 image 持有 frame 并 scale，会把影 / 圆角一起放大且无固定裁切框。应只给四个既有消费者补固定 frame，并让组件内部 image scale，保持所有 handlers/data。root已协调与11组件接口。
2. **精确 transition。** 原4主题 / 3构思行 / cityCTA / finalCTA / hotimg都使用 `.transition`。已有 source style-2 真实规则为 `color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter`（以及webkit别名），**150ms / cubic-bezier(.4,0,.2,1)**。stage前三类与final用 all、city没有过渡、hot仅transform；只修这些消费者。
3. **拼贴手写投影。** 原593行 `.drop-shadow` 是两层 filter：`drop-shadow(0 1px 2px rgba(0,0,0,.1)) drop-shadow(0 1px 1px rgba(0,0,0,.06))`。stage `.home-photo-main>text` 使用 text-shadow；应恢复原 filter 并去除替代 shadow。

上述三类均已修。最终只核这三类最小delta与精确inverse，不重跑 owner 80项 checker / 旧runtime / 所有字形。详见第7节。

## 6. 未完成阶段与验收界限

初始 stage 11照片仍旧 src 占位，root正在把 **11 原 JPEG / 683,581 B** 接异步 profile 分包组件；3已同 byte 原图复用。root共享8 font faces / 原700 outline与advance、5新unicode、600city原匹配也正在定向验证。此处不把已知 stage 旧图当 source 新缺陷，更不能称 stage 图片 / 字形 / 完整长页已完工。

最终11节点 / JSON注册 / consumer CSS及font增量已在第7节独立复核。根负责 CLI包体、WeChatSDK、真实绘制与按钮运行；本次无 CLI / SDK / Git / CI / 全量测试。原 max440 是整个页面 wrapper约束，当前首屏受既有保护且本 scope 未恢复大屏整页限宽；暂列跨core、大屏未验边界，不以本次 mobile 长页审查宣称平板一致。

真实账号活动、闭态文本、功能说明、示意标识、匿名符号取代原稿 fake nearby / testimonials / avatar等。这些是 R1真实性边界，因此不声称完整原PNG每个文本 / 样例人像一比一，也不声称真机 / 运营 / 生产验收。

## 7. 最终冻结：仅增量独立核验

最终 owner manifest `/private/tmp/caper-wave73-home-long/frozen-owned-paths.json`：12,342 B / SHA256 `6c98030c5b51d27ad84a3907dcbf7ff5fd0e6f7a884e26156ba9ff92834f8a9d`；读取其 `frozen-product/`，不读取并发产品半成品。

| 最终产品 | B | SHA256 |
|---|---:|---|
| index.wxml |43,747|9c35f217aefeaebfb33a003b996f127de9850e486ee431704d6480f816249f4e|
| index.wxss |110,058|9c370a6b694c57ee508e8c6c8a698094a1892c91d45e8b7f73a2b4244e8c9d87|
| index.js |32,598|d85b9db816163c4853bd2a7a9abec66dc62e8047d9e79c19457f4cb57dc8ac11|
| root-owned index.json |340|3f3022dfdd20e7a99f602b8f8fc6af5b0082e8d99a56d3e67a6d170300ec198a|

- 最终先只逆除四个 hot frame、七个CSS规则及唯一 append frame，再得到保留的已过80输入 WXML43,603 B / `d05adf6b78bde38217902e2e6dae847043dd842a51d0bd1048f6c3774c87a83a`、CSS107,076 B / `0fad19bb89114f0584837df52b02b20d499ee86db4bf6563e661914da1c76822`；再只逆除11组件 tag 与5selector变化，严格回到第1节已独审原始stage WXML / CSS，完整字节相等。没有重复62动作Counter或旧core/state全检。
- 直接读 source `transition`生成规则和最终五 selector组，对应4主题、3构思、city/final两CTA、4hot内图：三兼容属性声明与原相等，150ms/cubic(.4,0,.2,1)；.4与0.4只是CSS数值拼写差，不按误报改产品。hot框固定80/r16/overflow-hidden/shadow-sm、子图无自身radius/影/margin，实际 external photo-class image做scale1.05；collage原text-shadow撤销为none，两filter投影准确。
- 11 `reference-image` 节点key各唯一、photo-class和source consumer映射一致，无bind/catch/data写入；实际虚拟host组件只输出readonly `image` / aspectFill，允许key有完整静态映射，未知key为空。review只读其代码，没有重跑root3VM。
- 每张runtime JPEG直接读原响应文件逐字节比对，11全部相等 **683,581 B**，不重编码/不重下载/不改照片质量；brand1、hot4、idea3、collage3准确。所有key进入profile组件静态资产路径，无主包硬跨分包image-src。source旧3张准确照片继续原path，真实account cover/image仍原动态绑定，不改为示例用户照片。
- JSON由root独占改；旧parsed键值全等，仅新增 `usingComponents.reference-image` / `componentPlaceholder.reference-image=view`，不以JSON格式改变宣称原byte不变。官方合同与最低SDK/实际测试另见根分包计划与保留官方HTML。
- 四长页手写consumer的family/weight保持原source：brand16/24/700、doodle16/16/700、collage18/22.5/700、city12/16/nominal400；root实际新增Caveat600使原只有600/700时的city nominal400匹配准确。只读实际resource模块：共8face，Caveat700 Base64解码28,076 B / `f2fb6438cd2a04f9bcbb67fea2f9136208a99693156a533d1e2d8f28fb9628cd`，Caveat600解码11,624 B / `65a31f27c6f651920868421bc775a63546e843e478f66b137fe52f5069098379`，均与准确官方保存WOFF相等。没有再执行loader/FontTools/旧6face检查。
- 根共享proof明确其他6face/完整许可字节保持、旧700轮廓和advance保持；字体模块搬profile，由旧主loader `require.async`加载，global/webview desc.normal与weight保持，source/face失败resolve并fallback、不阻登录。☺ / ♡ / ⚡本来未在Caveat，保留原fallback，不冒充Caveat轮廓或另造glyph。
- root回调证据已有8faces/12JPEG解码，但8回调阶段是初home5新增字；随后发现页准确Latin另外6字E/H/O/T/u/v扩充，最终700payload需root最终SDK单项确认。这是根运行门，本独审不把前版回调用于宣称新版全部已加载。

完整独立source / 逆除 / key / JPEG SHA / readonlyfontpayload证明为旁同名JSON，不是产品样式镜像测试。初审的三类具体源码差距在本最终freeze已无遗留整改项；原R1内容、原生绘制、整页max440/core边界与正式环境资源范围按第6节保留。根最终CLI / native source绘制与实际button点击独立记录，不宣称39屏完工或生产通过。

独立证据 JSON：`docs/evidence/caper-home-ordinary-long-page-independent-review-wave73-2026-10-02.json`，24,796 B / SHA256 `a769e7a25ba7547b35b7bf3a5efb3c5ba7f9cf4b0baf8bf19908789964796acc`。
