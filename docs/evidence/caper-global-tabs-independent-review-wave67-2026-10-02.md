# Wave 67 五 Tab 独立只读审查

日期：2026-10-02。审查者：`ui65_font_audit`，组件实施者：`ui64_review`。只写本证据；未修改产品、配置、其他证据、字体或总矩阵，未运行既有20个VM、业务测试、全量/CI、微信CLI/SDK。根代理随后负责真实显隐、点击与包体验收。

结论：在冻结版本中，**未发现需修正的导航图形、源有效样式或真实绑定源码偏差**。这项结论是原稿/资源/绑定的源码审查，不是微信像素、系统字形或生命周期运行验收。

## 1. 身份与原材料

独立读取 `custom-tab-bar/index.js`、`index.wxml`、`index.wxss`、`index.json`、所有24个实际SVG、app.json实际tab注册及五页selected/hidden调用。使用实施者保存的 `/private/tmp/caper-wave67-tab-prep/component-before/` 作为原组件基线；原methods同时曾用只读 `git show a848617:.../index.js` 核对，根代理随后明确允许只读Git身份/内容核对，本次没有任何Git状态变化或mutation。

核对 `/private/tmp/caper-wave67-tab-prep/frozen-owned-paths.json` 的30个present文件大小/hash、8个旧SVG的absent状态；与真实文件全部一致。产品核心身份：

| 文件 | B | SHA-256 |
| --- | ---: | --- |
| custom-tab-bar/index.js | 1,689 | b5da7218741cc259ae18bb383992d40757414297a8672ca7c3a6ed3d9e7ff8fb |
| custom-tab-bar/index.wxml | 707 | 05bec473ca0a5e58d1ba504a360eada6925edb9938f4c3b56f3e074156c740b9 |
| custom-tab-bar/index.wxss | 3,464 | 08efca56512ef634a49a1bc1865493c6047553c247cefce0b6e3af0387ca209b |
| docs/evidence/caper-tab-assets-sources-wave67-2026-10-02.json | 54,019 | 26e10fe1fdeae97cff112c21c968a3a2639da69e4e1eabed77f404c5885ef2c7 |

完整读取五份源HTML，核head/font/CSS和完整bottom-nav；逐张查看五张完整PNG。再直接从用户ZIP读取10个HTML/PNG entry，确认与缓存逐字节一致。ZIP SHA-256：`df22e733d33fda20979b75b8a7bc94717c4a5c9e41561a54e3038432fab32603`。来源缓存目录为 `/private/tmp/irl-stitch-original/stitch_design_system_generator/`；PNG是缩放长图，不能将其像素直接当CSS px。

| 原页面 | HTML B / SHA-256 | PNG B / 尺寸 / SHA-256 |
| --- | --- | --- |
| caper_2 首页 | 48,084 / e4e4ba417711e27838f10cef098c4da8c428d3b9d7c4217fe36d9def5761c4ca | 278,231 / 177×1600 / 81028ecae6d89d2b77c70750e628c1e58a355dd52704e2a3646dcf392934f13f |
| caper_4 发现 | 63,270 / 514d9e5fbfbbc66e9c5c19cf33767b58b54f77a144720c4b89f3b5248356aed2 | 265,845 / 176×1600 / 15ffd670e926b6f508dac5223bb00e3beee8301a6a712a3836d468893a95d63e |
| caper_ai FORM | 43,225 / baa9cbbb84c513529e4df1f7efdaec4057a9585993242983565fd58d5b461628 | 200,437 / 238×1600 / 233c1db76acebe257d35350c33b5c8bae5ebf435a02f09b90b945072d2153dd5 |
| caper_3 消息 | 32,137 / 18fab22c6b92592673e19574739eb2ed86cbfb0fe628023ec5dcd3b843a1aa6b | 210,560 / 290×1600 / 85fc42cb05ea57b3afe81c594917572ead3122dfa5feb958595574fb5901da1b |
| caper_1 我的 | 42,473 / 37088f60630a26b0c2711c9ef018076d3ede9128cf33e5b7bf399fb66217faf9 | 192,288 / 212×1600 / 8901eb5958e4ecb9a209d40992c0214e5e6b1d89b99a64b5eabea22df6bbb369 |

## 2. 独立逐槽来源比较

没有执行实施者的check-component-contract或prepare脚本。一次独立只读比较从原HTML SVG直接构建几何/有效继承属性树，与应用SVG解析树相比：child tag、完整d/points及全部circle/line等坐标保持；解析fill/stroke/currentColor、stroke-width/cap/join，原me plus的CSS `stroke-[2.5]`按有效2.5处理。仅在根忽略class/XMLNS/受WXML提供的宽高，child几何宽高不忽略；白色短hex规范为相同颜色。样式上提后的有效树相等，不把compact SVG说成原raw child XML字节相等。

发现页5个glyph独立从已固定官方Phosphor Web 2.0.3 CSS找到codepoint、解析TTF cmap，再用原outline绘制到SVG line box；与实际path字符串逐字节比较，未运行会改应用的export脚本。TTF/CSS hash与固定官方来源元数据相等，em1024/ascent960/descent−64，变换为 `(1,0,0,-1,0,960)`；path未简化或重绘。官方证明在 `docs/design-sources/phosphor-web-2.0.3/`，不是运行时字体依赖。

下表每格是实际应用asset basename（共同目录 `miniprogram/assets/nav/`）及原HTML source line：

| selected / 原稿 | 首页 | 发现 | 发起 | 消息 | 我的 |
| --- | --- | --- | --- | --- | --- |
| 0 / caper_2 | h-home / 725 | h-find / 730 | h-plus / 736 | h-msg / 741 | h-me / 747 |
| 1 / caper_4 | d-home / 797 | d-find / 802 | d-plus / 808 | d-msg / 814 | d-me / 821 |
| 2 / caper_ai FORM | f-home / 711 | f-find / 716 | n-plus / 722 | f-msg / 728 | f-me / 734 |
| 3 / caper_3 | n-home / 558 | n-find / 563 | n-plus / 569 | n-msg / 575 | n-me / 582 |
| 4 / caper_1 | p-home / 753 | p-find / 758 | p-plus / 763 | p-msg / 768 | p-me / 773 |

25槽实际由 `icons[selected][index]` 指向24个不同SVG：仅FORM与消息的原同geometry/白stroke2.5 plus共享。普通glyph实际盒20px、plus24px，与源一致。

- 首页灰 `#9CA3AF`，其他页灰 `#94A3B8`，active蓝 `#1D64F2`、plus白；逐页解析，没有将两个灰色错误合并。
- 首页房子为准确实心path，消息圆气泡的三点是原 `h.01` 子路径，没有circle替代。
- 消息导航消息图形是蓝色实心方框；其房子/指南针/person为stroke1.8。
- 我的房子/指南针为stroke2，plus保持原两line端点5–19与默认butt/miter；person是完整实心path、头位置12/8，没有拆成近似circle/body。
- 发现分别是官方regular house U+EB9C、fill compass U+EA63、bold plus U+EC86、regular chat-teardrop-dots U+EA2D、regular user U+EDA0；没有Material替代。
- FORM灰实心home、搜索/气泡/person源几何均对应，白plus共享不改变source stroke。

## 3. 样式和 native 适配审查

原有效样式逐页核对产品selector，而非以一个统一模板覆盖五个源变体：

| variant | 源布局 / 产品结果 |
| --- | --- |
| 0 首页 | max440、水平24/垂直8、justify-between；label10/15/700、gap4；中心48、margin-top−20、stroke3；blur24、gray100边框、原−4/20阴影与floating双值 |
| 1 发现 | max390、水平24/垂直8、justify-between；label10/15、inactive500/active700、gap2；center52/p14/mt−24；blur16、原blue500/40双层shadow |
| 2 FORM | max420、水平8、justify-around、普通项48；center60/p14/border4、relative top−12，唯一显示“发起”10/15/900；`.bar-items`63+外框border1=实际64px内容栏，safe另加 |
| 3 消息 | max390、水平16/垂直8、五槽flex1；label10/15、inactive500/active700、gap2；center48/mt−16；slate200/80边框、blur12和原shadow-lg |
| 4 我的 | max390、水平24/垂直6、justify-between；label10/15、inactive500/active700、gap2；center48/mt−16；slate100边框、blur12、blue500/30双层shadow |

caper_4/caper_ai源码无有效spacing13配置，因此原w13/h13不猜52；发现的52来自有效p14+Phosphor line-height1的24pxglyph，FORM的60另含4px白边×2。与Tailwind3.4.17已缓存官方full config（spacing、blur、shadow、fontSize）及固定Phosphor CSS的line-height1一致。普通文案继承真实系统sans栈，发现body显式font覆盖和各页栈在variant中分别保留。

应用将原390px定宽夹至实际窄窗口并保留原max，属于计划允许的native适配；五栏均居中fixed，真正safe通过 `env(safe-area-inset-bottom)` 加入。原home safe-bottom fallback34不被猜成固定空白；不复制假状态栏/岛/home bar。FORM actions的64px+safe联动属于create owner，本次没有重复其检查。

原生button默认border/padding/min-height均显式清零；`overflow:visible`保留source浮动中心/阴影。原href/hover web展示改为既有真实switchTab；无新增业务能力。源各页demo静态红点依计划不复制，因缺少全局真实未读状态；这项受控差异明确保留，不能据此声称假消息事实。

## 4. 原行为和静态引用保护

`attached()`起的attached/pageLifetimes/all methods与原component-before完整字节一致。实际五个route/text依次是 `/pages/index/index` 首页、`/pages/discover/discover` 发现、`/pages/create/create` 发起、`/pages/messages/messages` 消息、`/pages/me/me` 我的，全部与app.json实际tab列表吻合。selected初始0/hidden初始false保留；没有额外variant状态或navigateTo替代。

`selectTab`继续Number(data-index)、无效/当前项return、真实wx.switchTab，仅成功callback更新selected；同步selected与create阶段hidden逻辑原字节保留。WXML原tabs loop/key、button/data-index/bindtap/aria-label、根 `!hidden`保留，两image分支选实际selected的对应图形；发起label仅FORM显示，匹配原其他四页没有该label。

五页真实调用仍在：index selected0、discover selected1、create syncCreateTabBar/setCreateStage、messages selected3/setTabBarHidden、me selected4。create IDEA/REVIEW隐藏、FORM显示；messages CENTER/CHAT_UNAVAILABLE隐藏、INBOX与onHide恢复规则保持。组件page-show与messages异步onShow最终执行顺序只能由微信实际运行确认，本审查不宣称源码相同就消除所有短暂显隐。

只读扫描产品JS/JSON/WXML/WXSS/WXS：8个旧SVG不存在，旧完整 `/assets/nav/<old>.svg` 引用0。新JS包含明确25basename，全部24真实文件存在；dynamic src只使用该固定二维数组，没有未知文件名拼接来源。SVG为本地XML/path等，无外部href、脚本、字体文件或新网络依赖。

## 5. 限定检查结果和边界

单次独立纯来源比较共 **119条静态断言 PASS**，包括30个冻结present身份、8个absent、20inline真实source identity/geometry/effective style、5官方outline及font/CSS/颜色/源class、methods/JSON/注册routes、25实际图形槽与旧引用清理。119不是业务或E2E测试数量。随后只补ZIP10entry/五原PNG来源相等读取，没有重跑组件已有20VM；所有业务/VM调用0、产品写入0。

24应用SVG共7,900 B，旧2,039 B；实施raw app增量8,015 B核对冻结记录一致。来源manifest只在docs。该差额不是实际编译包收益或主包合规证明，不能推算最终CLI包体。

待根代理限定验：五真实Tab实点/selected回返、native safe与中心圈、实际系统字体/按钮裁剪、IDEA→FORM→REVIEW显隐、消息INBOX→CENTER/CHAT→INBOX及实际FORM actions避让、最终编译包体。没有扩大到全量/CI，未替代39屏或整个项目验收。
