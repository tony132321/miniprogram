# Wave 67 五 Tab 原稿恢复：源码实施证据

日期：2026-10-02。root在Wave66冻结提交a848617后，明确授权本独占组件实施；执行 `docs/superpowers/plans/2026-10-02-tab-form-registration-reference-ui.md`。只改 `custom-tab-bar` 3个产品文件、24个准确小SVG，清理8个仅被原组件引用的旧SVG，并写本独占来源/证据。未改页面JS、global font、配置、矩阵；未操作Git/微信CLI/SDK/电脑操作，未跑全量/业务/CI。

## 1. 已实施

既有selected0–4直接选择home/discover/FORM/messages/me五套源图形与CSS；没有第二个variant状态，没有改变五目标/selected成功回调或hidden方法。模板仍是原tab数组/button/data-index/bindtap，替换近似图标与两条CSS plus矩形为原准确SVG。

| selected / 源 | 图形应用前缀 | 原有效布局 |
| --- | --- | --- |
|0 / caper_2 |h-* |max440、横24/纵8、justify-between，普通glyph20，label10/15/700/mt4；circle48无白边、mt−20、glyph24/stroke3 |
|1 / caper_4 |d-* |max390、横24/纵8、justify-between，Phosphor20/24、inactive500/active700/mt2；circle52/p14无白边、mt−24 |
|2，!hidden / caper_ai |f-*，plus复用n-plus |max420、横8、justify-around、普通项宽48；bar-items63+topborder1=源content64，另native safe；circle60/p14/border4、relative top−12；仅这里显示发起10/15/900 |
|3，!hidden / caper_3 |n-* |max390、横16/纵8、五项flex1；glyph20、label10/15/inactive500/active700/mt2；circle48无白边、mt−16；消息实心方框 |
|4 / caper_1 |p-* |max390、横24/纵6、justify-between；glyph20、label10/15/inactive500/active700/mt2；circle48无白边、mt−16；指南针stroke2/实心人物 |

各源底色、灰系、border1px、源shadow层/透明度、blur12/16/24、系统sans stack按原稿分别恢复。普通image literal20px、plus24px；不随rpx变字号/图形盒。caper4/form的无效w13/h13没有被当成合法token；circle52/60由原p14+准确24glyph（FORM另有border4×2）推得。

native适配明确：原固定390在窄窗口用width100%夹到实际宽度，仍保留原max390；home/max440与FORM/max420也保留。底栏居中fixed、保留真正 `env(safe-area-inset-bottom)`；source content py8/6与safe追加分开。原home `.safe-bottom`的浏览器env/utility级联不能用长截图推定34px，应用不硬加34。native button显式 `overflow:visible`让源浮动圈/阴影保持可见，不用mini button默认剪裁；清除原生button border/默认padding/min-height。没有新增模拟9:41/信号/电池/岛。

原5稿都有demo红点；没有可复用的全局真实未读绑定，按root授权**不复制静态红点/假数**。这项真实状态边界保留，不以UI复刻名义造消息。没有增加背景API、未读持久化或新交互。

## 2. 精确图形与来源

来源准备说明 `caper-tab-assets-prep-wave67-2026-10-02.md`，全稿/ZIP/hash/源线/元数据见 `caper-global-tab-reference-gap-audit-wave66-2026-10-02.md`。应用24SVG逐字节复制临时compact素材，短文件名仅减少引用长度。

原20次inline SVG经过原shape几何属性逐项比较、有效继承fill/stroke/width/cap/join canonical树相等检查；共同继承属性上提root、白色等价短hex、固定image尺寸从WXML/CSS提供，不改变d/points/circle/line坐标。只合并messages/FORM相同的白2.5加号。home灰#9ca3af，其他源灰#94a3b8，active蓝#1d64f2，源笔画1.8/2/2.5/3以及me加号5–19端点均保留。

discover5glyph来自既有官方Phosphor web2.0.3（regular house U+EB9C/chat-teardrop-dots U+EA2D/user U+EDA0；fill compass U+EA63；bold plus U+EC86）。cmap/font outline、em1024/ascent960/descent−64、坐标变换(1,0,0,−1,0,960)和完整path hash固定；无轮廓简化/重画/Material替代。现卡片compass仅复用原准确outline，独立nav蓝色不改原卡片#60a5fa。

完整checked-in来源manifest：`docs/evidence/caper-tab-assets-sources-wave67-2026-10-02.json`，54019 B，SHA256 `26e10fe1fdeae97cff112c21c968a3a2639da69e4e1eabed77f404c5885ef2c7`。包含原child节点/有效属性/字体CSS/hash/25source slots/24应用asset映射；**docs-only**，未进主包。原官方TTF/CSS继续docs-only，没有整份字体/图片新增。

## 3. 必要限定检查及保留行为

执行一次 `/private/tmp/caper-wave67-tab-prep/check-component-contract.js`（实际Node绝对runtime），exit0，failures0。结果 `implementation-check.json`：

- attached、page-show及所有methods从`attached()`起与基线逐字节相同；component JSON字节不变。
- 20个VM契约情形：5实际route→selected，IDEA/FORM/REVIEW的同步与setter共6，5按钮实际switchTab URL/成功selected，4无效/同selected不跳。
- 24应用SVG与临时准确素材逐字节相等；25slot/24个不同asset真实存在；FORM/message白2.5plus共享。
- WXML root !hidden、center index2 guard、5按钮的wx:for/key/data-index/bindtap/aria-label保留；两个image分支都绑定实际selected的图形行；发起文字仅selected2。
- 原8SVG删除前`rg /assets/nav/ miniprogram`仅原component JS4处引用；删除后遍历JS/JSON/WXML/WXSS/WXS确认无旧完整路径引用。没有假red/badge/unread或navigateTo替换switchTab。

此后因真实native/button和源width几何剩余风险，补 `overflow:visible`及max440/390/420，并只复核这些CSS声明/最终hash；未重复上述VM或图形检查。首次apply_patch尝试同路径delete+add WXSS被工具拒绝，未应用；改正常顺序更新后实施，没有留下半套删除状态。准备脚本namespace问题在前一prep证据记录。

hide契约：IDEA/REVIEW仍由create `setCreateStage`隐藏，FORM显示；messages CENTER/CHAT_UNAVAILABLE仍由既有setTabBarHidden隐藏，INBOX恢复。所有业务页面JS untouched；旧methods保持字节。不把VM合同认作微信生命周期实点。FORM固定action offset64px+safe由create owner独占处理，本组件未改其页面；未启动任何业务写入。

## 4. 冻结产品身份与字节预算

| 产品路径 | B | SHA256 |
| --- | ---: | --- |
| `miniprogram/custom-tab-bar/index.js` | 1689 | `b5da7218741cc259ae18bb383992d40757414297a8672ca7c3a6ed3d9e7ff8fb` |
| `miniprogram/custom-tab-bar/index.wxml` | 707 | `05bec473ca0a5e58d1ba504a360eada6925edb9938f4c3b56f3e074156c740b9` |
| `miniprogram/custom-tab-bar/index.wxss` | 3464 | `08efca56512ef634a49a1bc1865493c6047553c247cefce0b6e3af0387ca209b` |

24个SVG共7,900 B；原8SVG共2,039 B；media净增5,861 B。三个source净增2154 B；总app raw净增 **8015 B**。当前root实际main剩3,063 B，这个新raw增量已超余量；不靠删除原glyph或搬无实际编译收益的JSON解决。最终真实CLI压缩/预算由root与预算代理负责，未声称主包验收。

产品added24/removed8完整hash均在temporary frozen manifest与docs source JSON。本批shortname→准确来源：

| 应用SVG，目录miniprogram/assets/nav | B | SHA256 |
| --- | ---: | --- |
| `h-home.svg` | 129 | `0d93d6e45ea8a9db98d98f32c0f9edc4ee15dcf1c1c6db1b38bae89f40599127` |
| `h-find.svg` | 215 | `38cc7ccce5cdd0313b2dd5666308dd5b4d4b402b91b86d52837ac90cc1acd034` |
| `h-plus.svg` | 183 | `a888fce4fa766d3b6de7bf4e0b54b3956bbce14b405a2dbd06dfd9ac0cb6d3bc` |
| `h-msg.svg` | 329 | `827cb2ea6b00c71514bae57340e63ab9078442c08ac5e22efb09463479aa713f` |
| `h-me.svg` | 239 | `07df44e6107f653683b7b6d6864f93c2f447fa6d91e80d52bc95ccbafa022387` |
| `n-home.svg` | 215 | `38befba40441c61667b3ff635e5e571cbcfa29b24e2aea0269cd46fc918ea8c6` |
| `n-find.svg` | 221 | `5c59cd6f25005c28c053b1e8f15111cc345d68cd6d242caa480f9601d4b80398` |
| `n-plus.svg` | 185 | `b363c7333810f450b119ae9de42dca6e4a353f6f74588c74f9ddf4de108edac4` |
| `n-msg.svg` | 160 | `bd60addfb1541b237223ff5501db7c6272e85262ce3e17e5e3b68077edbc0faa` |
| `n-me.svg` | 198 | `a06abde5786d176e7bf7fac1f1cd195ba8c170cd1c37d9104b9bb89dc3cf9c09` |
| `p-home.svg` | 213 | `e742fa1b58c64b4a8392bfe373bdb28802a0470665f0028cc0242ee3af031865` |
| `p-find.svg` | 219 | `4fc500eb6aae0ea2e5691b71658f074b465d5dd4001c0ca47c1585669ec8cfa1` |
| `p-plus.svg` | 188 | `d81a595ec7464ee36709e049c84da394e0292454ddc4bb11bf1982caae03a436` |
| `p-msg.svg` | 186 | `0ac77114e2c06e81b0dba5a53541a5e1d91ff9b6cf89076507180eaa3f4b6372` |
| `p-me.svg` | 203 | `0d6d462ac9e5ea77e33eea3a485d8359f3b1a651af34a76e47a7be09535a5c2f` |
| `f-home.svg` | 129 | `1f589c2995dfc98a9127bb8e8e92c0a8af6c22b5ff2212bd913684615cbd47fb` |
| `f-find.svg` | 215 | `496b4f27d87c202e87f332dc5d43e4f19063bdc6e515e2786252472a356fbf17` |
| `f-msg.svg` | 329 | `93c7c2db13c0e910f6c0e1ccc659381ca23bf643ce8cdf621f5a680182cbf6f1` |
| `f-me.svg` | 239 | `ffd5c55b62069ece66fba519cd4714b11a54b00d879e532bef514f5393abb157` |
| `d-home.svg` | 669 | `300996766af1c93c7d80b9754eb5c81d5259112fa2b76425e744687b07dd696b` |
| `d-find.svg` | 701 | `73c02679eb661a24aebddbe19ca7f841b263a1beb0e89474ca710b617e3c9e78` |
| `d-plus.svg` | 424 | `8babadde2c34a30a0b4072eb3a9c4e94470aa5cce24b99fa42be5b647df4ca0e` |
| `d-msg.svg` | 1031 | `174b8ad5880db219b8e20a6d16a4d2a783e3b307b22df91bc7efb5f9159c9b40` |
| `d-me.svg` | 1080 | `7961d204b5e9beb6422ff10dcb434c688cde99ec5857be75c6f09f9d34ed1f45` |

`/private/tmp/caper-wave67-tab-prep/frozen-owned-paths.json`列出三个source、24新SVG、8旧SVG应缺失和本独占证据身份；供root只读review/同步使用。准备doc是授权前只读阶段记录，本实施doc反映随后明确授权的应用状态。

## 5. 待root限定验收

五个来源变体实际渲染/字体/中心阴影/本机safe、各真实Tab实点及selected/回返、create IDEA→FORM→REVIEW显隐、messages INBOX→CENTER/CHAT→INBOX显隐与FORM action64px联动待root新批限定CLI/SDK/CUA确认。没有重复Wave66已通过页内项，没有全量/CI，也未宣称39原屏或整个项目已通过。
