# Wave66 全局五 Tab 原稿差异审计（只读，未实施）

日期：2026-10-02。范围：用户 ZIP 中 `caper_2`、`caper_3`、`caper_4`、`caper_1`、`pg03_ai`、`caper_ai` 的原底栏；现有 `custom-tab-bar` 全部 4 个文件、`app.json`、8 个 nav SVG、5 页实际 selected/hidden 调用。未修改应用、配置、其他人的证据或验收矩阵；未操作 Git、微信 CLI/SDK/电脑操作；未跑业务测试、全量测试、CI。

## 1. 结论与下一批最小范围

**共享底栏尚未恢复到这些原稿。** 五条已注册 Tab 路线的静态目标正确；源图形、颜色、尺寸、标签字重、中心钮、横向分配、透明度、模糊、边框与阴影存在具体差异。六份原稿不是同一个底栏：应依据当前页/发起阶段选择源变体，不能拿同一套图形仅换选中颜色，也不能自行选一个“统一风格”。本报告只列来源与现状，不把静态审查称为微信点击/像素验收。

最小后续范围是 `custom-tab-bar/index.js/.wxml/.wxss` 和必要的准确小 SVG；使用既有五目标及 `syncSelected`、`setCreateStage`、`selectTab`。页面业务 JS、Wave66 A/B/C 页面与资源保持冻结。无须引入新图片或整份图标字体。

`pg03_ai` 对应 `IDEA`，原本**没有五 Tab**；`caper_ai` 对应 `FORM`，有五 Tab 和“发起”标签。现有 `IDEA/REVIEW` 隐藏、`FORM` 显示规则，以及消息 `CENTER/CHAT_UNAVAILABLE` 隐藏规则，要保护。全局换肤不能覆盖这些规则。

## 2. 用户原稿与读取证据

用户 ZIP：`/Users/tsb/Downloads/stitch_design_system_generator (2).zip`，24,668,856 B，SHA256 `df22e733d33fda20979b75b8a7bc94717c4a5c9e41561a54e3038432fab32603`。直接从 ZIP 读取下表 12 个 entry，与 `/private/tmp/irl-stitch-original/stitch_design_system_generator/` 缓存逐字节相等。六份 HTML 的全文读取/底栏与 head/layout 解析完成；六张完整 PNG 通过 `view_image` 逐张查看。PNG 是缩放后的整页长截图，不能把其像素当成微信窗口 CSS px。

| 原稿 | HTML B / SHA256 | PNG B / SHA256 / 尺寸 |
| --- | --- | --- |
| `caper_2` 首页 | 48,084 / `e4e4ba417711e27838f10cef098c4da8c428d3b9d7c4217fe36d9def5761c4ca` | 278,231 / `81028ecae6d89d2b77c70750e628c1e58a355dd52704e2a3646dcf392934f13f` / 177 × 1600 |
| `caper_3` 消息 | 32,137 / `18fab22c6b92592673e19574739eb2ed86cbfb0fe628023ec5dcd3b843a1aa6b` | 210,560 / `85fc42cb05ea57b3afe81c594917572ead3122dfa5feb958595574fb5901da1b` / 290 × 1600 |
| `caper_4` 发现 | 63,270 / `514d9e5fbfbbc66e9c5c19cf33767b58b54f77a144720c4b89f3b5248356aed2` | 265,845 / `15ffd670e926b6f508dac5223bb00e3beee8301a6a712a3836d468893a95d63e` / 176 × 1600 |
| `caper_1` 我的 | 42,473 / `37088f60630a26b0c2711c9ef018076d3ede9128cf33e5b7bf399fb66217faf9` | 192,288 / `8901eb5958e4ecb9a209d40992c0214e5e6b1d89b99a64b5eabea22df6bbb369` / 212 × 1600 |
| `pg03_ai` IDEA | 20,435 / `a9dcecb66acbfe35c004d66b178dd3594197b2d5b1688c6feaada09a30ca0497` | 486,721 / `b6cfb7394783c1793a823be7065822a14ce38c635eaaead09467aa9506b78463` / 718 × 1600 |
| `caper_ai` FORM | 43,225 / `baa9cbbb84c513529e4df1f7efdaec4057a9585993242983565fd58d5b461628` | 200,437 / `233c1db76acebe257d35350c33b5c8bae5ebf435a02f09b90b945072d2153dd5` / 238 × 1600 |

来源行号使用缓存原 HTML 一致的真实行号：home `722–750`、messages `555–585`、discover 底栏 `794–824`（`129–140` 另一个 nav 是顶部分类，不混入底栏）、me `750–776`、FORM `708–737`。IDEA 没有 `<nav>`，`118` 起是生成按钮 tray；不能把这块替换成五 Tab。

## 3. 原图形逐页映射

以下颜色均指**实际源 CSS**：brand-blue `#1d64f2`；home 灰为 gray-400 `#9ca3af`，其它四份有底栏的稿为 slate-400 `#94a3b8`。hover 是网页鼠标态，不作为微信静止态颜色。SVG 全部 `viewBox 0 0 24 24`；普通图形盒 20 × 20 px，加号盒 24 × 24 px。

| 页 / Tab | 首页 glyph | 发现 glyph | 中心 glyph | 消息 glyph | 我的 glyph |
| --- | --- | --- | --- | --- | --- |
| home `caper_2` | 725：蓝色填充房子，`M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z` | 730：灰色搜索，stroke2，`M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z` | 736：白色 `M12 4v16m8-8H4`，stroke3/round cap+join | 741：灰色带三点圆气泡，stroke2；三点也是原 path 子路径 `h.01` | 747：灰色人物轮廓，stroke2，原头和身同一个 path |
| messages `caper_3` | 558：灰色描边房子 `m3 9 9-7 9 7v11…` + `polyline 9 22 9 12 15 12 15 22`，stroke1.8 | 563：灰色圆10/菱形指南针，stroke1.8 | 569：白色 `M12 4v16m8-8H4`，stroke2.5/round cap+join | 575：**蓝色实心方消息框** `M20 2H4…`，不是三点圆气泡 | 582：灰色上半身+圆形头，stroke1.8 |
| discover `caper_4` | 797：`ph ph-house`，regular，灰 | 802：**`ph-fill ph-compass`**，fill，蓝 | 808：`ph-bold ph-plus`，bold，白 | 814：`ph ph-chat-teardrop-dots`，regular，灰 | 821：`ph ph-user`，regular，灰 |
| me `caper_1` | 753：与 messages 相同房子 geometry，**stroke2** | 758：圆10/菱形指南针，**stroke2** | 763：白色两个 `<line>`，端点5到19，stroke2.5；不同于其它源端点4到20的 path | 768：灰色方框尾巴轮廓，stroke2，`M21 15a2 2 0 0 1-2 2H7l-4 4V5…` | 773：**蓝色实心人物**，头中心(12,8)，原整体 path `M12 12c2.21…` |
| FORM `caper_ai` | 711：和 home 同 geometry，灰色**填充** | 716：和 home 同搜索 geometry，灰、stroke2 | 722：同 messages 加号 geometry、stroke2.5，白 | 728：同 home 三点圆气泡 geometry，灰、stroke2 | 734：同 home 人物 geometry，灰、stroke2 |

当前 8 个 `/assets/nav/*.svg` 与上述 4 份 inline SVG 底栏做逐子节点几何比较，**没有一个完整相同的 glyph tree**。例如当前 home-active 路径起点是 `M12 2 2 10…`，不是源 `M10 20v-6…`；当前消息把原 `h.01` 点重画成 radius1 的 circles；当前 profile-active 把原一整个实心人物 path 拆成不同头位置的 circle+body path。搜索也是 circle(10.8,10.8,r7)+另一条 handle，源为一个完整 path。相似外观不构成准确来源复用证明。

### 3.1 Discover Phosphor 精确来源与可复用部分

必须沿用原 `@phosphor-icons/web@2.0.3`，不能换 Material/其它 Phosphor 版本/统一 stroke。已存在 docs-only 证明字体，可只导出这 5 个实际 glyph 为小 SVG，不增加整套字体：

| glyph / 源 style | Unicode / 真实 CSS 行 | 字号/line-height | 颜色 |
| --- | --- | --- | --- |
| house regular | U+EB9C；`regular/style.css:2031–2033` | 20px / 1 | `#94a3b8` |
| compass fill | U+EA63；`fill/style.css:1092–1094` | 20px / 1 | `#1d64f2` |
| plus bold | U+EC86；`bold/style.css:2733–2735` | 24px / 1 | `#ffffff` |
| chat-teardrop-dots regular | U+EA2D；`regular/style.css:930–932` | 20px / 1 | `#94a3b8` |
| user regular | U+EDA0；`regular/style.css:3579–3581` | 20px / 1 | `#94a3b8` |

原 CSS style 的 `font-weight:normal`、`font-style:normal`、`line-height:1` 位于各 CSS `12–20`；bold/fill 是各自原字体家族，不是向 regular glyph 增加 CSS weight。字体原 em1024/ascent960/descent−64；已有导出坐标转换 `(1,0,0,-1,0,960)` 可复用。

准确可复用 geometry 路径：`miniprogram/pages/discover/assets/ph-compass-fill.svg`，对应 U+EA63/源 fill 字体，当前 SHA256 `c5607060e580011be2cc0a6f3e8ecf76162862789d5652fa3e6f2e79f06b95b3`，path SHA256 `5a92144d98b3b2b3587ee96b624f3beac0ad5f98e2be99e87f72cfefd9d1903d`。**该现有 SVG 颜色是 `#60a5fa`，服务于卡片9px标签；底栏要20px/#1d64f2**。不能把现有卡片 SVG 改蓝而破坏已冻结卡片。可从同一个准确 outline 得独立蓝色 variant；其余 4 个导航 glyph 尚无已核准确 app SVG，不冒称可原字节复用。

证明文件全部在 `docs/design-sources/phosphor-web-2.0.3/`，不需要加入主包：regular CSS63,985 B / SHA256 `ae360472b03f686e8327d0440ac943bbf3e25ae3a833e7ff530aef1ce33ab44d`；fill CSS70,315 B / `2d2b5281299a3a849ac8d3ceb42b8e3107b820c20e4e82687bfc8ec4f7e9a0fc`；bold CSS70,315 B / `c2b4f3dbe9960e4ed9ffa0c78b19a2210f946cfb4bb01b53b4fce64afaee2961`。其 TTF 与 source.json 提供已固定原字形，不重新寻找“相近图标”。

## 4. 原尺寸、布局、字体、视觉层与安全区

表内是源 Tailwind CSS px 字面值在16px rem基线的展开；不是按375→390等比缩放。当前 rpx 在括号内仅用375px窗口 `1rpx=.5px` 描述源码差异，未做微信测量。原 `h-13/w-13` 无默认 utility，必须推导实际 intrinsic 布局，不能宣称“原指定52px”。

| 项目 | home | messages | discover | me | FORM |
| --- | --- | --- | --- | --- | --- |
| 宽度 | w-full/max440 | 固定390 | w-full/max390 | 固定390 | w-full/max420 |
| 横内边 / 分配 |24px / justify-between；4个文字项固有宽、中心48 |16px / **五项 flex1**等分内容区 |24px / justify-between；固有文字项、中心intrinsic |24px / justify-between；固有文字项、中心48 |8px / **justify-around**；4文字项宽48，中心固有宽 |
| 顶/底内边 |py8；另safe-bottom见下 |py8 |py8 |py6 |明确height64/垂直center，无py utility |
| 普通标签 |10px/line15；全部weight700；glyph后gap4 |10px/line15；inactive500、active700；glyph mb2 |10px/line15；inactive500、active700；glyph后mt2 |10px/line15；inactive500、active700；glyph后mt2 |10px/line15；inactive500；glyph后mt2 |
| 中心圈 |48×48，无白边，父层mt−20 |48×48，无白边，父层mt−16 |无效w13/h13；p14 + Phosphor24/line1 = intrinsic52×52，无白边，父层mt−24 |48×48，无白边，元素mt−16 |无效w13/h13；p14 + SVG24 + border4×2 = intrinsic60×60，父层relative top−12 |
| 发起文字 |无 |无 |无 |无 |10px/line15、weight900、蓝色、mt2 |
| 圈阴影 |`0 12px 32px -6px rgba(29,100,242,.35)` |源shadow-lg，两层blue500/#3b82f6/.40 |同messages |源shadow-lg，两层blue500/.30 |`0 8px 24px -4px rgba(29,100,242,.35)` |
| 底栏底色/blur |white95% /24px |white95% /12px |white95% /16px |white95% /12px |白色100% /无blur |
| top border |1px/#f3f4f6 |1px/#e2e8f0/80% |1px/#e2e8f0 |1px/#f1f5f9 |1px/#e2e8f0 |
| 底栏阴影 |`0 -4px 20px rgba(0,0,0,.04)` |原shadow-lg向下两层 |无 |无 |无 |

Tailwind3.4.17 官方已缓存 `config.full.js:841–885` 无spacing13；blur md12/lg16/xl24在71–80，shadow-lg在108–113，text-xl20/28在329。文件24,958 B / SHA256 `8f3394e8a4990a7b678d3462b6e1440b84c11a6c06e55d7b26108b90a1fcc538`；只读路径 `/private/tmp/caper-wave66-event-review/tailwind-3.4.17-source/config.full.js`。Discover glyph line box最终遵循 Phosphor CSS line-height1，因此加号20/24的普通Tailwind行高不能误带入 intrinsic52的推导。

原五份底栏都是系统 sans stack，没有需新增的手写/Plus Jakarta 字体。home包含SF Pro Display/Text、PingFang/Hiragino；messages及FORM包含PingFang/Hiragino/Microsoft YaHei；discover实际body样式为 -apple-system/BlinkMacSystemFont/SF Pro Display/PingFang；me为 -apple-system/BlinkMacSystemFont/SF Pro Text/PingFang/Helvetica Neue。当前component没有明确font-family；全局 `app.wxss` 的page也没有font-family；不能把页面scope的字体声明当成组件字形已验证。小程序客户端字体解析/系统fallback仍属后续渲染边界。

### 4.1 safe-area 与模拟状态栏边界

- home HTML `51–55` 自定义 `.safe-bottom { padding-bottom:env(safe-area-inset-bottom,34px) }`；这不是固定加34px，也与nav的`py2`同时存在。最终底部padding还取决于CDN utility/style层次与浏览器的env是否可用。不能凭长截图推定所有客户端取34px。
- messages/discover/me/FORM底栏没有safe-bottom env规则；只有home viewport带`viewport-fit=cover`。IDEA `2` 自有 `.pb-safe/.pt-safe`（fallback0），底部 `118` tray有pb32，无五Tab。
- 微信需要真实原生safe-area，当前bar已有 `padding-bottom:env(safe-area-inset-bottom)`，这是合理的native适配入口。后续每变体明确保留原content区尺寸及真实safe追加，不能将原fixed390直接塞进窄微信窗口，也不能把safe值当原白边或标签gap。
- 原9:41、电池、信号、Dynamic Island全部是网页的顶部模拟系统UI。它们不属于五Tab，也不应在微信原生status/capsule下重复绘制。底栏变更不涉及已冻结各页header/capsule几何。
- source的home/messages正文pb112、discover95、FORMpb144是各长页留白；当前home250rpx、discover200rpx、me170rpx、messages有效外层175rpx（messages.wxss53覆盖第1行120rpx）及FORM106rpx+safe是现工程留白。若新底栏总高度变动，应只在真实遮挡证据出现后确定受影响内容/FORM action的必要补偿，不借此全页重排或重测已通过区域。FORM `.form-actions`/`.sticky-actions` 使用106rpx+safe offset，后续如果FORM底栏改为源64px须明确该联动风险；IDEA/REVIEW各自scope的bottom-safe规则保护。

## 5. 当前组件具体差异

`custom-tab-bar/index.wxss:1–13` 是单一风格，未选择上述来源变体：

1. 高106rpx（375时53px）、横padding22rpx（11px）、每项flex1、justify-space-around；只有messages稿的flex1可相近，仍缺源横16px。
2. glyph38rpx（19px）、标签20rpx（10px但390时10.4px）、margin8rpx（4px）、全部weight700。源glyph全部literal20px；只有homegap4/字重700吻合375下的数值，其它稿labelgap2/inactive500。
3. inactive固定`#9a9fa9`，与源两个灰系均不同；active蓝正确。图形根内硬编码颜色，单换button color不能修SVG。
4. 中心82rpx（41px）、白border6rpx（3px）、mt−24rpx（−12px）、两条白色CSS矩形35rpx×5rpx（17.5×2.5px）。这些既不是源48px无边，也不是source FORM60px/border4；plus的准确圆角path/端点/笔画差异也未表达。
5. 所有状态都会render“发起”标签；源仅FORM需要。当前标签并不能从unselected/selected CSS判断哪些来源显示。
6. 背景white96%、border1rpx/#e9ebf0、统一阴影`0 -8rpx 30rpx rgba(28,41,61,.04)`、无backdrop-filter，和各稿源参数有差异。
7. 当前nav没有红点或未读count绑定。原每份有底栏的稿都含消息红点，来源位置/色不同：home top0/right4/8px/red500(`#ef4444`)+white1px；messages在glyph wrapper top−2/right−4/8px/brand-badge(`#ff3b30`)+white1px；discover top−4/right−4/8px/rose500(`#f43f5e`)无白边；me top0/right4/8px/rose500无白边；FORM top0/right8/8px/red500无白边。原demo静态红点不能直接伪造为真实未读。未来实现需接现有真实计数/状态，数据不可用时不新造消息；现有home `unreadTotal`、messages `unreadTotal`并不等于组件已得到数据。

## 6. 现有真实路线与生命周期保护

| index | component `pagePath` / app.json Tab | 页面selected调用 | 状态用途 |
| --- | --- | --- | --- |
|0 | `/pages/index/index` / `pages/index/index` | index.js256–257：selected0 |普通首页/已有业务state-view共用此Tab，不能因state-view造新路线 |
|1 | `/pages/discover/discover` / `pages/discover/discover` | discover.js97–98：selected1 |真实discover页；分类/灵感保留各自实际处理 |
|2 | `/pages/create/create` / `pages/create/create` | create.js82–86：setCreateStage或fallbackselected2 |IDEA、FORM、REVIEW共一个既有route；FORM显示，另两stage隐藏 |
|3 | `/pages/messages/messages` / `pages/messages/messages` | messages.js174–175：selected3 |INBOX显示；CENTER/CHAT_UNAVAILABLE通过setTabBarHidden隐藏 |
|4 | `/pages/me/me` / `pages/me/me` | me.js312：selected4 |真实本人页，授权/安全高级区维持 |

五目标在 `app.json.pages` 和 `tabBar.list`均已注册，component数据数组 `index.js:1–7` 与它们一致。WXML按钮 `data-index={{index}}` / `bindtap=selectTab`，`index.js:26–30` 校验目标、同selected不重复switch、成功后更新selected；真实 `wx.switchTab` URL来自这份数组，不来自原HTML的`#home/#/#profile`锚点。**静态路线存在**不等同已经实点每条往返。

component `attached` 和 `pageLifetimes.show`调用 `syncSelected`：从实际当前route计算selected；create route且stage非FORM隐藏。`setCreateStage`明确selected2与hidden。create.js138起onShow先同步；`setEditorData`89–91对stage patch同步，existing FORM/REVIEW/IDEA切换均复用该入口。换肤不得改生成、草稿恢复、编辑、发布或其失败行为。

messages.js200–205同时写组件hidden、调用wx.hide/showTabBar；onShow192根据viewMode设hidden，onHide198恢复，进入CENTER/CHAT及return按239/248/255/330更新。component的page-show同步与这些页面调用的最终执行次序属于微信运行确认；本次不凭源码声称无短暂显隐。其隐藏契约必须保留，variant更新不得顺便把hidden统一写false。

## 7. 读取时的组件与资源 hash

| 路径 | B | SHA256 |
| --- | ---: | --- |
| `miniprogram/custom-tab-bar/index.js` |1693 | `144807d85b144d75f913c31faeceba4898f08754ace1fb4f2c8fd27f4d2f6689` |
| `miniprogram/custom-tab-bar/index.wxml` |645 | `67f75b2a4dc4a0dcd5f6abf3f2b6b9f81aa37852771478a57edadf8acf8c9960` |
| `miniprogram/custom-tab-bar/index.wxss` |1368 | `b230a00a80bf109f6ba888f6a20111d5a78ab9c401596b4ed6e0899f89be2ab5` |
| `miniprogram/custom-tab-bar/index.json` |22 | `e7b657f5a4b032a68e9e084639b3a5564ce552896d269c3f8c4463bf7a7fa3b5` |
| `miniprogram/app.json` |1240 | `274e7000b47d38ccdd63ce8dfb3fbf52829792707d6b660a75e0d7c0214c2e9c` |
| `miniprogram/assets/nav/home-active.svg` |150 | `582c8f622799f00b3f7f2c96eb0a484a16412ad29eac11f36e30c57d4b9f81c6` |
| `miniprogram/assets/nav/home.svg` |231 | `4e9e22544b07f75d92bfbab2da15e2602a8915a756f674596b0824a6ac4133b5` |
| `miniprogram/assets/nav/message-active.svg` |383 | `8b64c9e762bb639fd535175884515ecb2f2db0fcea9e1852e1fdf1990cb45af7` |
| `miniprogram/assets/nav/message.svg` |385 | `d61f3ee38beaebafff93f4c41ecae1d51010b1cf47afb9f68d6d4444fff47c21` |
| `miniprogram/assets/nav/profile-active.svg` |160 | `74d92d00b1196435edbdac7380e0ba8a07c6a03f110bb8206d7f8f9fd9265fd8` |
| `miniprogram/assets/nav/profile.svg` |248 | `b564fcebdf7fe5a6ed7f6f96c0d719e247223e7a7c44bf63b469c214e1ec7138` |
| `miniprogram/assets/nav/search-active.svg` |239 | `a1e3b1b96553a65a5555a3e31c14f41536908c1d24a8e54bbde9a03816a7c6f2` |
| `miniprogram/assets/nav/search.svg` |243 | `04511f64377b5e2411ebe50a88ce3b319000565a1b067ecf7d14f7893b7d37d3` |

## 8. 包预算与未验证边界

8个旧nav SVG总2,039 B；未来以实际必要小SVG替换/增加有可能增包，但本次没有生成资产，**没有虚构新增字节数**。Phosphor已固定TTF/CSS留docs；原稿HTML/PNG/整份图标库/额外照片都不进入主包。字体代理的独立预算优化由其独占处理，本文件不改字体/许可/打包配置。

历史Wave65 CLI主包2,046,014 B、当时距2 MiB剩51,138 B；Wave66 A/B/C raw源增量接近耗尽这段空间，不能据源码字节加法宣称当前preview仍合法。后续导航实施前及最终编译须由root以同一冻结源、实际CLI主包结果确认空间。真实safe、字体、当前选中态/返回态、FORM固定action位置以及五目标实际点击，都由root的限定渲染/实点确认；未全量测试，不在本报告通过。39原屏、20路由、真机/外部环境验收也不由此补齐。
