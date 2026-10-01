# Wave 67 五 Tab 原稿 SVG 准备（临时素材，未接入产品）

日期：2026-10-02。依据 root 明确范围，仅在 `/private/tmp/caper-wave67-tab-prep/` 提取准确素材，并写本独占 evidence。当前应用与 Wave 66 A/B/C 保持冻结；未改页面 JS、共享组件、global font、配置、矩阵，未操作 Git/微信 CLI/SDK，未运行全量或业务测试。

## 1. 可审查交付与预算结论

- `source-variants/`：25 个 SVG，共 **8,675 B**。20 个来自 home/messages/me/FORM 的准确 inline SVG，另5个来自 discover 原 Phosphor web 2.0.3。保留20px/24px intrinsic尺寸、原viewBox、原有效颜色/笔画。
- `compact-assets/`：24 个 SVG，共 **7,900 B**。仅规范公共继承样式、去除由小程序 image CSS指定的width/height、将白色#ffffff写为等价#fff，并按完整输出相同字节去重。没有简化/重画/缩短路径、四舍五入或更换图标家族。
- 唯一同字节合并：`caper_ai` 的白色2.5加号与 `caper_3-create.svg` 相同；FORM映射复用后者。其余来源 stroke/颜色/节点差异均保留，不能进一步按“看起来相近”合并。
- 当前8个nav SVG共2,039 B；**素材净增5,861 B**。root报告的实际主包剩余3,063 B，仅素材便差 **2,798 B**，还未计新组件variant表/WXML/WXSS。既有6 JSON迁出没有降低编译预算，因此不把搬manifest算成可用空间。本次没有编译，不声称package验收。
- 19个compact inline SVG共3,995 B；5个exact Phosphor SVG共3,905 B。完整HTML/PNG、Phosphor字体、CSS和49KB临时manifest都不进入主包。

临时根目录：`/private/tmp/caper-wave67-tab-prep/`。完整逐个来源、源child geometry、有效fill/stroke/stroke-width/linecap/linejoin、源HTML行/hash、原稿尺寸、字体/Unicode/path/hash、raw和compact路径映射见 `manifest.json`（48,939 B，SHA256 `47078c6bf808ba450273bd49e37b17f910fcbb4a1de285fddd3486de98d6fd8c`）。复现脚本 `prepare-tab-assets.py`（8,921 B，SHA256 `c3c87818603cf77ffcf5aabeb5c9a648ca627609c838c8fdf5f62b41961ad3a3`）只写此临时目录，不执行原现有导出脚本，避免它写回app/source.json或下载。

## 2. 来源与准确性检查

原HTML路径 `/private/tmp/irl-stitch-original/stitch_design_system_generator/{caper_2,caper_3,caper_4,caper_1,caper_ai}/code.html`。前一只读审计已直接验证用户ZIP的HTML/PNG与缓存全部相等，并逐张看完整PNG；hash、所有视觉差异、safe/status边界详见 `docs/evidence/caper-global-tab-reference-gap-audit-wave66-2026-10-02.md`。`pg03_ai` 的 IDEA 原稿没有五Tab，本次没有给它伪造底栏或新增图形。

每个inline图形都直接解析原nav的SVG子节点，`d`、`points`、`cx/cy/r`、`x1/x2/y1/y2` 属性值与原节点逐项相等；web `viewbox` 正规化成XML的 `viewBox`，`currentColor` 解析为该具体源变体的实际颜色。me原class `stroke-[2.5]`落实在SVG上，不因移除webclass丢失。root `xmlns` 为独立SVG必须的namespace。

compact仅把所有shape共同的**已计算有效继承属性**放到SVG root；给非共同项保留各shape属性。通过包含完整geometry和每个shape有效图形属性的canonical树比较，证明源variant和compact等价；#fff先正规化到#ffffff再比较。只移继承属性，不改源geometry。compact必须由组件CSS给普通image20×20px、createimage24×24px，不能用默认300×150 intrinsic尺寸。

Phosphor仅读取现有docs-only官方2.0.3的TTF/CSS，使用已安装FontTools4.60.2，从CSS对应Unicode到原cmap/glyph outline，用SVGPathPen和唯一坐标变换 `(1,0,0,-1,0,960)` 导出到原1024×1024 line box。ascent960/descent−64、advance1024。完整path保持该导出原字符串；没有把bold/fill变成regular加CSS weight。5个glyph分别为：regular house U+EB9C、fill compass U+EA63、bold plus U+EC86、regular chat-teardrop-dots U+EA2D、regular user U+EDA0；源CSS每类line-height1。

已做必要的源/资源准备检查：20个inline shape属性比较+25个variant生成；20个compact effective-style canonical等价比较；Phosphor5个完整path/raw-to-compact相等；现有discover `ph-compass-fill.svg` 的完整d与临时nav compass完全相等（path SHA256 `5a92144d98b3b2b3587ee96b624f3beac0ad5f98e2be99e87f72cfefd9d1903d`）。现有卡片色#60a5fa；临时nav variant色#1d64f2，未改冻结卡片。首次脚本检查使用无namespace的`find('path')`，因namespace未匹配而中止；订正为`find('{*}path')`后只重跑本次必要准备，不是渲染或业务回归测试。

## 3. 最小compact inline资源（19个）

文件全在 `/private/tmp/caper-wave67-tab-prep/compact-assets/`。编号source line是原HTML真实行；源geometry/有效stroke详见manifest。普通slot20px，center24px；图形盒尺寸不等于外面的浮动圆钮尺寸。

| 文件 | 来源行 / image尺寸 / 色 | B | SHA256 |
| --- | --- | ---: | --- |
| `caper_2-home.svg` | caper_2:725 / 20px / #1d64f2 | 129 | `0d93d6e45ea8a9db98d98f32c0f9edc4ee15dcf1c1c6db1b38bae89f40599127` |
| `caper_2-discover.svg` | caper_2:730 / 20px / #9ca3af | 215 | `38cc7ccce5cdd0313b2dd5666308dd5b4d4b402b91b86d52837ac90cc1acd034` |
| `caper_2-create.svg` | caper_2:736 / 24px / #ffffff | 183 | `a888fce4fa766d3b6de7bf4e0b54b3956bbce14b405a2dbd06dfd9ac0cb6d3bc` |
| `caper_2-messages.svg` | caper_2:741 / 20px / #9ca3af | 329 | `827cb2ea6b00c71514bae57340e63ab9078442c08ac5e22efb09463479aa713f` |
| `caper_2-me.svg` | caper_2:747 / 20px / #9ca3af | 239 | `07df44e6107f653683b7b6d6864f93c2f447fa6d91e80d52bc95ccbafa022387` |
| `caper_3-home.svg` | caper_3:558 / 20px / #94a3b8 | 215 | `38befba40441c61667b3ff635e5e571cbcfa29b24e2aea0269cd46fc918ea8c6` |
| `caper_3-discover.svg` | caper_3:563 / 20px / #94a3b8 | 221 | `5c59cd6f25005c28c053b1e8f15111cc345d68cd6d242caa480f9601d4b80398` |
| `caper_3-create.svg` | caper_3:569 / 24px / #ffffff | 185 | `b363c7333810f450b119ae9de42dca6e4a353f6f74588c74f9ddf4de108edac4` |
| `caper_3-messages.svg` | caper_3:575 / 20px / #1d64f2 | 160 | `bd60addfb1541b237223ff5501db7c6272e85262ce3e17e5e3b68077edbc0faa` |
| `caper_3-me.svg` | caper_3:582 / 20px / #94a3b8 | 198 | `a06abde5786d176e7bf7fac1f1cd195ba8c170cd1c37d9104b9bb89dc3cf9c09` |
| `caper_1-home.svg` | caper_1:753 / 20px / #94a3b8 | 213 | `e742fa1b58c64b4a8392bfe373bdb28802a0470665f0028cc0242ee3af031865` |
| `caper_1-discover.svg` | caper_1:758 / 20px / #94a3b8 | 219 | `4fc500eb6aae0ea2e5691b71658f074b465d5dd4001c0ca47c1585669ec8cfa1` |
| `caper_1-create.svg` | caper_1:763 / 24px / #ffffff | 188 | `d81a595ec7464ee36709e049c84da394e0292454ddc4bb11bf1982caae03a436` |
| `caper_1-messages.svg` | caper_1:768 / 20px / #94a3b8 | 186 | `0ac77114e2c06e81b0dba5a53541a5e1d91ff9b6cf89076507180eaa3f4b6372` |
| `caper_1-me.svg` | caper_1:773 / 20px / #1d64f2 | 203 | `0d6d462ac9e5ea77e33eea3a485d8359f3b1a651af34a76e47a7be09535a5c2f` |
| `caper_ai-home.svg` | caper_ai:711 / 20px / #94a3b8 | 129 | `1f589c2995dfc98a9127bb8e8e92c0a8af6c22b5ff2212bd913684615cbd47fb` |
| `caper_ai-discover.svg` | caper_ai:716 / 20px / #94a3b8 | 215 | `496b4f27d87c202e87f332dc5d43e4f19063bdc6e515e2786252472a356fbf17` |
| `caper_ai-messages.svg` | caper_ai:728 / 20px / #94a3b8 | 329 | `93c7c2db13c0e910f6c0e1ccc659381ca23bf643ce8cdf621f5a680182cbf6f1` |
| `caper_ai-me.svg` | caper_ai:734 / 20px / #94a3b8 | 239 | `ffd5c55b62069ece66fba519cd4714b11a54b00d879e532bef514f5393abb157` |

FORM的create slot必须明确映射到 `caper_3-create.svg`（185 B），源行 `caper_ai:722`，24px/#ffffff/stroke2.5；不会添加第二份相同SVG。

## 4. 最小compact Phosphor资源（5个）

同一compact目录；全部以原font outline导出，viewBox1024，不使用24 viewBox重画。证据TTF/CSS留 `docs/design-sources/phosphor-web-2.0.3/`。

| 文件 | 官方style / Unicode / 原HTML行 | image尺寸 / 色 | B | SHA256 |
| --- | --- | --- | ---: | --- |
| `caper_4-ph-house-regular.svg` | regular / U+EB9C / 797 | 20px / #94a3b8 | 669 | `300996766af1c93c7d80b9754eb5c81d5259112fa2b76425e744687b07dd696b` |
| `caper_4-ph-compass-fill.svg` | fill / U+EA63 / 802 | 20px / #1d64f2 | 701 | `73c02679eb661a24aebddbe19ca7f841b263a1beb0e89474ca710b617e3c9e78` |
| `caper_4-ph-plus-bold.svg` | bold / U+EC86 / 808 | 24px / #ffffff | 424 | `8babadde2c34a30a0b4072eb3a9c4e94470aa5cce24b99fa42be5b647df4ca0e` |
| `caper_4-ph-chat-teardrop-dots-regular.svg` | regular / U+EA2D / 814 | 20px / #94a3b8 | 1031 | `174b8ad5880db219b8e20a6d16a4d2a783e3b307b22df91bc7efb5f9159c9b40` |
| `caper_4-ph-user-regular.svg` | regular / U+EDA0 / 821 | 20px / #94a3b8 | 1080 | `7961d204b5e9beb6422ff10dcb434c688cde99ec5857be75c6f09f9d34ed1f45` |

## 5. 组件独占变体建议（未实施）

保持既有 `tabs` 五个真实URL与 `data-index` / `bindtap=selectTab`。可让模板/样式直接由现有 `selected` 0–4选择五份source variant，无需新增一个可能与selected失配的全局状态，也无需改每页onShow：

| selected | source variant | slot图形资源前缀 | 标签/中心来源 |
| --- | --- | --- | --- |
|0 |home `caper_2` |`caper_2-*` |4标签700/gap4；48px无白边、无发起文字、源3stroke加号 |
|1 |discover `caper_4` |`caper_4-ph-*` |原Phosphor；52px有效intrinsic（无效w13/h13不推新token）、无发起文字 |
|2，且!hidden |FORM `caper_ai` |`caper_ai-*`，create复用`caper_3-create.svg` |source64px底栏；center有效60px/border4；发起10px/900 |
|3，且!hidden |INBOX `caper_3` |`caper_3-*` |原5项flex1/横16；48px无白边、无发起文字、实心蓝消息 |
|4 |me `caper_1` |`caper_1-*` |原stroke2指南针/方框消息/实心人物；48px无白边、无发起文字 |

组件的图形数据表包含这5个固定asset映射；WXML使用实际selected选择对应mapping和variant class。不要只按选中蓝/未选中灰重用同一套8glyph，因为原稿的指南针/搜索、圆气泡/方框、实心房子/轮廓、style权重不同。CSS literal20/24/10px及每份原padding/分配/shadow/blur取前一来源审计；不全局rpx缩放。center也用准确SVG，不能继续两条CSS矩形近似。

保留现有component的 `syncSelected`、`setCreateStage`、`selectTab` 实际路由语义；IDEA和REVIEW仍hidden，FORM显示。messages CENTER/CHAT_UNAVAILABLE仍由既有 `setTabBarHidden`隐藏，INBOX恢复；variant不得把hidden统一改false、不得借此替换业务处理。

五条真实目标仍是 `/pages/index/index`、`/pages/discover/discover`、`/pages/create/create`、`/pages/messages/messages`、`/pages/me/me`。原HTML `#/#profile/#messages`只供来源解释，不落成假导航。当前source静态红点来自demo；组件没有可复用全页真实未读绑定，本批**不制造红点或未读数**。后续数据接入若需改页面/全局状态必须由root计划单独明确。

FORM原Tab64px及source fixed action bottom64px联动，由root下一批计划指定；本次不调整现有106rpx+safe offsets。native safe追加与各源content高度分开记录；不会加入原9:41/电池/信号/Dynamic Island模拟状态UI，也不改Wave66冻结header胶囊几何。

## 6. 未修改的组件 hash 与验收边界

准备前后component4文件SHA256与前一只读审计一致：JS `144807d85b144d75f913c31faeceba4898f08754ace1fb4f2c8fd27f4d2f6689`；WXML `67f75b2a4dc4a0dcd5f6abf3f2b6b9f81aa37852771478a57edadf8acf8c9960`；WXSS `b230a00a80bf109f6ba888f6a20111d5a78ab9c401596b4ed6e0899f89be2ab5`；JSON `e7b657f5a4b032a68e9e084639b3a5564ce552896d269c3f8c4463bf7a7fa3b5`。

source准备通过仅表示属性/字形来源证明；没有mini-program SVG渲染、safe测量、layout像素、5路线实际点击、main preview bytes或所有39屏验收。收到root后续明确组件授权并有包体方案后才接入应用。实际主包余3,063 B与source raw净增不是同一个计量口径；5,861 B只是确定的文件增量，不能作为最终CLI包体数。
