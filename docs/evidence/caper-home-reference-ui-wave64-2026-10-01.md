# Wave64 首页原稿组件恢复：源码证据

日期：2026-10-01。实现基线：`d66bdba36e3028aff2e833d6aa9973be3713da37`。本证据只确认原稿来源、有限组件源码恢复及一次静态自检；尚未取得本批微信运行或视觉通过证据。

## 独占范围与原稿

只修改 `miniprogram/pages/index/index.wxml`、`index.wxss`，新增该页 `assets/` 内 7 个原稿 SVG 和 `manifest.json`，本文件及独占 `.superpowers/sdd/2026-10-01-core-tabs-reference-ui/task-1-report.md`。`index.js` 字节不变。实现前完整阅读 accepted plan、Wave64 scope audit、Task1 brief、`caper_2/code.html` / `screen.png`、当前首页完整 WXML/WXSS/JS 和 `app.wxss`。没有写入其他页面、共享素材、总矩阵或公共导航，也没有操作 Git、微信 CLI/SDK/CUA。

原稿来自 `/private/tmp/irl-stitch-original/stitch_design_system_generator/caper_2/`：HTML SHA-256 `e4e4ba417711e27838f10cef098c4da8c428d3b9d7c4217fe36d9def5761c4ca`；PNG SHA-256 `81028ecae6d89d2b77c70750e628c1e58a355dd52704e2a3646dcf392934f13f`。完整 PNG 为 177×1600 缩小长图；源容器是 `w-full max-w-[440px]`，不以 177px 推导原组件尺寸。

## 已恢复的原 CSS px

新源 token 均保留 CSS px 字面值，不按 2rpx 放大。页宽继续适配真实微信窗口；新增 `.home-reference-core` 只对首页首屏使用 `margin: 0 calc(16px - 28rpx)` 抵消既有 `.home-main` 的 28rpx gutter，使这部分水平 inset 为源 16px。其余长页与状态页仍使用此前布局。

| 对应原节点 | 当前恢复值 |
| --- | --- |
| HTML 94–112 品牌、城市、铃铛 | Logo 28px / radius12px / ⁂16px；品牌16px+9px；城市12px、padding4px×10px、源chevron12px；铃铛32px / 源SVG16px |
| HTML 122–140 Hero | padding20px / radius28px / border1px；原 `to bottom right` 三色 `#d4f84c → #b6f041 → #3b82f6`；原soft shadow；sticker top8px/right−12px/rotate12°/radius16px/padding6px×12px；kicker18px、标题24px/900/上4px下2px、副文12px |
| HTML 136–140 输入 | padding6px、left14px / 源mic16px / 输入12px / 提交32px / 源arrow16px且rotate45°；本地文字构思与草稿保护保持 |
| HTML 148–191 六分类 | 源48px×48px / radius16px / 五个emoji20px、更多16px / label11px / label gap6px；源六种背景与边框；全宽justify-between、内水平4px |
| HTML 198–220 主封面 | radius24px / cover224px / 原top14px / badge11px、padding4px×10px / 按钮24px+源glyph14px；overlay bottom80%/middle30%/top20%；poster24px、tagline14px、间距2px |
| HTML 224–253 事实区 | padding16px / title16px/800 / status11px、padding2px×10px / facts12px、gap4px / calendar和pin14px、rowgap6px；真实capacityLabel及非人物装饰仍有原条件 |

分类第三项只把模板装饰 `item.icon` 映射为 `index === 2 ? '🍸' : item.icon`；`categoryIdeas` 的标签、tone、数据、dataset 和事件完全保留。实际六个装饰是 🏸 / 🥘 / 🍸 / 🏙️ / 🎲 / •••。分类行 `width:100%`、`min-width:288px`；402px窗口时源inset后的core为370px，内分类行可用362px，大于六个48px图形盒合计288px。该计算是源码布局约束；当前设备实际位置/首屏完整显示等待root测量。

## 原生与真实业务适配

- 状态栏沿用真实 `statusBarHeight`；app header 为56px，仍绑定现有 `headerPaddingRight()` 对真实胶囊留白。源iPhone时间/动态岛/系统图形未复制。普通header保留源字级与控制尺寸；flex spacer 的两侧负margin仅让原两个10px组内gap与真实胶囊剩余宽度协作。
- Avatar为既有无照片的通用人物替代，恢复36px外尺寸和蓝色ring，保留 `goProfile`；没有下载原示例人物照片，也没有在线状态声明。
- 麦克风只作为 `aria-hidden` 的无事件装饰；Hero保留“本地助手整理活动草稿”与文字input、原submission。未新增语音录制/点击行为，语音不可用。
- Hero副文、真实主卡标题/日期/场地/状态/人数与配图说明继续使用已有R1文本和表达式。空主卡保持“发起灵感”和原发起路径；不抄原3月22日/蓝天场地/16人/人物照片。
- 源分类HOT标记没有加入：当前分类没有真实热门度数据。真实未读条件仍决定铃铛红点。
- 源参与者头像组保留为已有三枚✦通用标记，只在真实capacityLabel可用时显示。既有“配图仅作示意/以详情为准/查看详情”和空卡提示仍是明确的业务适配，原稿没有这条额外说明行。
- 源sans字体声明及 `Caveat / Permanent Marker / cursive / sans-serif` 仅在本次header/core节点声明。未下载或加载手写字体，字体实际渲染未验证，不能声称手写字形匹配。

## 精确SVG资产

原全页22个inline SVG；本批仅提取与首屏对应的7个，**1843bytes**。系统状态/共享底栏和长页glyph未纳入。页内manifest为5413bytes，新资源合计7256bytes。每条manifest记录源HTML整体hash、PNG hash、源节点行、源SVG序号、原片段hash、归一化SVG hash、解析的currentColor、render CSS px及归一化步骤。归一化仅移除Tailwind root class、`viewbox`改XML `viewBox`、加SVG namespace、固定原继承颜色；子元素path/stroke属性逐字不变，没有换图标家族。

| 本地资源 | 原HTML行 | 原颜色 / CSS px |
| --- | --- | --- |
| `city-chevron.svg` | 105 | #6b7280 /12 |
| `notification-bell.svg` | 111 | #374151 /16 |
| `microphone.svg` | 137 | #1d64f2 /16 |
| `idea-arrow.svg` | 140 | #ffffff /16，CSS rotate45° |
| `feature-chevron.svg` | 211 | #ffffff /14 |
| `calendar.svg` | 236 | #9ca3af /14 |
| `map-pin.svg` | 240 | #9ca3af /14 |

铃铛是唯一跨普通/状态header共用替换的图形：状态页按钮原48rpx×48rpx保持，图形默认26rpx×26rpx；普通header以明确ordinary-view规则恢复16px源glyph。原CSS绘制bell的三个无用规则替换成image规则，其余既有CSS逐字保留。

## 一次最小自检

使用bundled Python一次静态检查，结果PASS；原始输出在 `/private/tmp/wave64-home-owner/selfcheck.json`。确认：

- `index.js` 与实现前字节相等，SHA-256仍为 `c0e7f279fab82c31311f5ae4de6984d9631f47cb7486468d1ebe77896d082b88`。
- 100组有业务意义的节点属性（wx条件/循环/key、bind/catch、id、data、disabled/loading/value、maxlength/confirm-type）序列完全相等。动态表达式仅有允许的root普通class与分类第三emoji装饰例外。
- WXML通过结构XML检查；校验时仅规范wx属性前缀、为boolean wx:else加空值、转义已有文本裸&，没有因此改写产品文本。
- 全部7条SVG refs=7条manifest；源/产物hash、XML viewBox、源行与路径/stroke完全一致。
- 从state-ai-banner开始的全部状态/草稿区WXML字节相等；原活动灵感开始到长feed末尾WXML字节相等。既有WXSS除共享bell替换外逐字相等。
- 70条新增CSS全部限定 `.ordinary-view` 或 `.caper-top .home-reference-core`，没有未限定的feature/category覆盖；状态页按钮原48rpx尺寸规则仍在。

没有新增镜像测试，没有运行业务、全量、本地/CI或微信工具。root之后需独立复核源HTML/PNG与最终cascade，并在freeze版本进行：首页header/gutter/原尺寸/六分类实测；一个真实主卡同ID详情；受影响城市、消息、我的、Hero原路径。未取得真机、外部服务、运营或39屏整体像素验收结论。

## 冻结文件hash

以下为实现者一次检查完成后的产品文件；本证据与local report是后写的交接文字。

| 文件 | bytes | SHA-256 |
| --- | --- | --- |
| `miniprogram/pages/index/index.wxml` | 24707 | `fcbf2764f06abb13207f5534b51bb7c93f563fd42ad4de3ddc55bda424a60da0` |
| `miniprogram/pages/index/index.wxss` | 47655 | `5fd04b24883cc3a89188e989e4d04f9ba70ece8d4d9f88916380e07dfceb6aa0` |
| `miniprogram/pages/index/index.js` | 32534 | `c0e7f279fab82c31311f5ae4de6984d9631f47cb7486468d1ebe77896d082b88` |
| `miniprogram/pages/index/assets/calendar.svg` | 264 | `a3e84154e5213e67f9e3799bac1469170a29648a19635b5e67abf0e75981103a` |
| `miniprogram/pages/index/assets/city-chevron.svg` | 194 | `e9761e5feed109364ce70d40315a31a778daa22fb827c7ff2d4a32a2e64e7603` |
| `miniprogram/pages/index/assets/feature-chevron.svg` | 192 | `a445abcf0ee7b8370c31312dd2b8602b17775317bdf5e073f060a2786c945c01` |
| `miniprogram/pages/index/assets/idea-arrow.svg` | 205 | `f7db5551d5d6bb5728b3c523434933809a9255dec3643e9b8429ab36ed7168e9` |
| `miniprogram/pages/index/assets/manifest.json` | 5413 | `0d1c73ad8483d1e016e828260ecbbdbaf3999a422d365446fae1d1d8893aca99` |
| `miniprogram/pages/index/assets/map-pin.svg` | 357 | `9418a7d5542f51b17686ae8a7748ec97d38162b582bc7ac3f4ed0e51154734f3` |
| `miniprogram/pages/index/assets/microphone.svg` | 264 | `f3d1da2e3202e33a9b57d7fd872a4c1aee327ca73775f82e0b72d3eb11b4bc3b` |
| `miniprogram/pages/index/assets/notification-bell.svg` | 367 | `c649021a51231a33e9c17b30fd66473343b987fa47395ba341598b61638b32b6` |
