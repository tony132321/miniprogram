# Wave64 三个核心 Tab 的独立源码复审

批次日期：2026-10-01；复审完成日期：2026-10-02（Asia/Shanghai）。基线 `d66bdba36e3028aff2e833d6aa9973be3713da37`。复审者与三个实现者独立，仅写本文件；没有修改产品、共享文档、原素材、测试或 Git 状态，没有操作微信 CLI／SDK／CUA。

## 结论与范围

**在本批已冻结的三个组件范围内，未发现需要修改产品的源码或资产缺陷。独立静态交叉检查通过。** 这个结论只覆盖：首页普通状态顶栏、Hero、六分类、主卡；发现页顶栏、分类、四张灵感主卡；我的顶栏、个人卡、四统计、勋章、兴趣、真实授权卡与本人活动卡。微信渲染、实际胶囊布局、滚动焦点和点击路线由 root 另行取得有界运行证据，本文件不代替这些检查。

已阅读 accepted plan、完整 scope audit、三份 freeze 报告、三个原 HTML，并直接查看原三张 PNG；结合当前 WXML、完整 CSS 有效级联、基线差异、现有公共样式及三个 JS 的逐字节比较复核。原 SVG 从原 HTML 独立重取，不只核对实现者清单；发现页轮廓从保留的精确字体独立重取，并与当前 SVG 完整 path 比较。

新组件的来源尺寸保留 CSS px 字面值。首页源 `max-width:440px`，发现／我的源布局宽390px；当前使用原生窗口宽度，缩小长图的177／176／212px没有用来推算尺寸。真实状态栏、56px app header 和现有胶囊留白是明确平台适配；原模拟系统栏和共同底栏不属于这三个组件的复审结果。

## 原稿核对

| 原稿 | HTML SHA-256 | PNG SHA-256 |
| --- | --- | --- |
| `caper_2` 首页 | `e4e4ba417711e27838f10cef098c4da8c428d3b9d7c4217fe36d9def5761c4ca` | `81028ecae6d89d2b77c70750e628c1e58a355dd52704e2a3646dcf392934f13f` |
| `caper_4` 发现 | `514d9e5fbfbbc66e9c5c19cf33767b58b54f77a144720c4b89f3b5248356aed2` | `15ffd670e926b6f508dac5223bb00e3beee8301a6a712a3836d468893a95d63e` |
| `caper_1` 我的 | `37088f60630a26b0c2711c9ef018076d3ede9128cf33e5b7bf399fb66217faf9` | `8901eb5958e4ecb9a209d40992c0214e5e6b1d89b99a64b5eabea22df6bbb369` |

### 首页

- 有效源 token：品牌28／12、文字16／9、城市12／p4×10、铃铛32／glyph16；Hero p20／r28、原三色方向与透明度、贴纸top8／right−12／rotate12／r16；kicker18、标题24／900、输入12、提交32／arrow16／rotate45；六盒48／r16、emoji20、label11／gap6；主封面224／r24、80%／30%／20% overlay、poster24／tagline14、事实p16／title16／status11／facts12／glyph14。
- 所有新增规则限定 `.ordinary-view` 或 `.caper-top .home-reference-core`。原普通主卡与 Hero 的 px 没有覆盖 PG02-B/C/D、草稿列表或后半长页卡；原状态／草稿区 WXML、首屏之后的长页 WXML 独立比较字节相等。唯一共享改动是原铃铛的 SVG 替换，状态按钮仍48rpx，默认图形26rpx；这项范围在计划与交接中明确。
- `calc(16px - 28rpx)` 只抵消旧承载容器的 gutter，原组件 inset 为16px；分类全宽与六个48px盒的约束可读，实际横向完整显示仍需 root 运行测量。
- 真实城市、未读条件、活动 ID／标题／时间／场地／状态／容量继续绑定原数据。空卡发起、Hero 文字提交及关闭类别沿用原 handler。麦克风仅是无绑定的装饰；本地构思文案、示意配图说明和非人物标记保持，未引入示例参与者或热门量。

### 发现

- 有效源 token：logo32、中文20／英文12／gap8、context16＋subtitle10／mt2、两个动作32／glyph18／gap12；分类font12／p6×16或p6×14／gap8／top12／bottom10／白95%／blur12；四卡inset12／gap12／r16／image176／body10／title14／copy11／facts10、heart盒28／glyph14／top10／right10。
- Header仍为原相对定位，native header／shield为56px，分类顶部一致为 `statusBarHeight + 56px`。Context使用剩余 flex 宽度，只有描述副句允许 ellipsis；没有缩小原品牌、标题或按钮来挤入胶囊。现有 nearby 函数继续测量 `.category-scroll`，没有引入新的固定 JS 偏移。实际定位可见性待 root 的局部检查。
- 四卡分别保留源城市80／30／20、篮球85／40／20及咖啡／桌游85／40／transparent的 overlay 与 z10／z20层级。逐卡 sticker font／color／spacing 与来源一致；card与font样式限定当前首组件，没有扩大到邀请和本人活动的其他 card。
- 四原照片独立与 Git 基线比较，字节相等。当前“暂无活动时间／暂无真实场地／仅供构思·暂不可报名”、搜索／筛选／收藏的关闭绑定保留；未加入来源样本日期、场馆、好友量、主理人或评价。从 `discovery-entry-strip` 开始的后半 WXML 字节相等。

### 我的

- 有效源 token：品牌28／play16／字16＋10；设置、扫描32／glyph20；个人卡p16／r24／头像64／border2／white ring2／heading20／900／handle12／mt4／caption12／mt8；统计mt20／pt16／数字18／label10／mt2；核心章节14／marker6×14／link12／mt20／mb10；四徽章gap8／p10／r16／emoji盒40／字20／title12／copy9；兴趣12／p6×14／gap8；授权卡p14／r16／gap14／32盒／glyph16；本人卡gap10／p8／r16／photo96／r12／title12／meta10。
- 隐私行标题最终为原 HTML `text-xs` 的 **12px**，不是旧计划描述的14px。真实授权说明自然换行；同意条件、提交中、不确定状态、重核、说明更新与禁用表达式全部保留。原生 `<switch>` 的 `.85` 缩放为平台适配，不据此宣称源自绘44×26开关逐像素一致。
- `.me-core-card`及具体core类在后置级联覆盖旧核心尺寸，原共享 `.card` 与安全表单规则继续保留。`advancedOpen` 内部直到帮助区域之前 WXML 字节相等，既有通知／申诉／内容复核／数据请求／举报的焦点 anchor 与操作继续保留。页级16px gutter为声明的原生承载适配。
- 原“我／我的空间／登录状态”、真实四项统计、真实本人活动、加载及错误表达式保留。四个徽章仍“待开放”，第四装饰为原🤝；没有在线点、示例 Léo 照片、等级、MAX／TOP／99+、虚构活动或好友事实。

## 独立静态结果

1. 直接从基线读取三个 JS，与当前逐字节相等。按每个元素的 id／bind／catch／data／wx／disabled／checked／value／loading／maxlength／confirm-type／aria 合同核对：首页100个节点、我的111个节点逐序相同；发现原59个业务节点全部保留，最终63个（额外4个仅对应装饰glyph选择的3个条件及1个else）。这与实现者按**属性项**计数的110口径不同，不混称110个节点。
2. 首页7个SVG（1843bytes）与我的8个变体（2622bytes）均从原 HTML 独立重取：原节点hash、真实行号、产物hash、viewBox、原颜色和**子 XML 字节**完全相等。归一化只发生在SVG根，未重绘路径／stroke。我的8变体对应7种几何，蓝／灰chevron区别是原颜色。
3. 发现9个SVG（8625bytes）：3个bold、4个fill、2个regular，均来自 **`@phosphor-icons/web@2.0.3`**；未替换为Material。独立读取原HTML对应 `ph`／`ph-bold`／`ph-fill` 节点，按原CSS Unicode映射到原TTF，再以 `(1,0,0,-1,0,960)` 重取完整outline；path、viewBox、原色与当前SVG完全一致。
4. 另从官方 registry 固定tarball读入内存，6732920bytes，SHA-256 `74049f3206cce8e9cf8fc279adf17b2c4e3d300cf13b22cac638480ed1546cad`；SHA512 integrity和SHA1 shasum与固定版本 metadata 一致。当前保留三TTF、三CSS及MIT许可与tarball对应文件**字节相等**。npm pin为2.0.3，三font内部name-table版本都是 `Version 2.0`，未混写版本。
5. 三页所有静态图片路径存在；页面新增assets只有24个SVG，无TTF／WOFF入小程序包。三manifest与产物交叉一致。页面重复引用与原组件共享不当作新增独立资产。

本复审没有运行全量或业务测试。第一次合并静态检查在字体阶段触发检查器自设5MB下载上限，而原官方tarball为6.73MB；此前源码／绑定／SVG项已通过。定位为检查器上限后，仅继续字体／tarball窄检查并输出最终文件hash；没有因该检查器问题改产品或重跑业务矩阵。

## 已复核的冻结文件 hash

| 页面 | WXML SHA-256 | WXSS SHA-256 | JS SHA-256（与基线相等） |
| --- | --- | --- | --- |
| 首页 | `fcbf2764f06abb13207f5534b51bb7c93f563fd42ad4de3ddc55bda424a60da0` | `5fd04b24883cc3a89188e989e4d04f9ba70ece8d4d9f88916380e07dfceb6aa0` | `c0e7f279fab82c31311f5ae4de6984d9631f47cb7486468d1ebe77896d082b88` |
| 发现 | `712b837104da4ba86ac372b2a9f2a1bad7b5aff9df40c9fa5b8b14b95f62bc8c` | `b2e7823086c5f30b69ba25bf1605136e52bcefd0d48cbb94f4c03abb65d32e13` | `9644a52f186b3f5ce3b99389849571f8a8110c3a3045c70f383ee407c7c9592a` |
| 我的 | `6b9348f72e03f955bb8c19b6c3996270eeb52d19bdcc76134a53c200eb9f2a7f` | `c090c16406ddcb5b85f5cea37c5fc8581df0a5f7907b23c6f423daec2e37fb7d` | `def9a36a9c46deca17cebbe95e5bd8672469eea6e759fd279b45d28c9f87021b` |

| 页面来源清单 | SHA-256 |
| --- | --- |
| `index/assets/manifest.json` | `0d1c73ad8483d1e016e828260ecbbdbaf3999a422d365446fae1d1d8893aca99` |
| `discover/assets/phosphor-sources.json` | `f4f229a006e06bd1388752ac0921d07ddb3415251ec64bfebd3fb7d1588382d2` |
| `me/assets/source-manifest.json` | `1fef1e21fc1599a1b4f83119dd05becc06a6c2a7a86e82fdd8e1fdd37c88b4ba` |

## 必须分开的验收边界

本复审没有取得微信SVG／blur实际渲染、首屏完整布局、胶囊碰撞、路线点击或焦点可见性证据。系统sans的实际渲染也未独立测量；首页Caveat／Permanent Marker、发现Caveat／Segoe Print仅声明fallback链，未加载或验证手写字体，不能声称字形完全一致。

本批的原稿长页其余区域、共同导航、39个屏／状态的整体逐像素匹配没有自动通过。正式AppID、HTTPS合法域名／配置、订阅消息、真机、真人运营与三场受控活动仍属另行验收资源；三份静态报告或本复审均不构成外部环境通过结论。
