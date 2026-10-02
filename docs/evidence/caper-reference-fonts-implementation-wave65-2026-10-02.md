# Wave65 原稿字体接入：实现与限定初始化证据

日期：2026-10-02。按 `docs/superpowers/plans/2026-10-02-reference-fonts.md` 继续用户已授权的原稿恢复；本地基线由root记录为 `6cf710ee750000d32639e5649466620bec2d6dac`。字体来源沿用已冻结的 `caper-source-font-gap-audit-wave65-2026-10-01.md`，没有新增字体设计或外部部署依赖。

## 独占修改与产品行为

实现者修改 `app.js`，新增 `utils/reference-fonts.js` 与 `utils/reference-font-data.js`，只在 H / H1 / H2 / H3 页 WXSS追加字体 family；保存准确官方资源/元数据/CSS来源及完整OFL到 `docs/design-sources/reference-fonts/`、`docs/licenses/`。首页两句原有的Caveat family已经正确，本轮无需再改首页。

- `app.js`只新增loader require及onLaunch末尾的初始化调用，放在原登录分支之后。删除这两行后，全部原字节hash仍为 `a5698428315a8a76bfcf8140151468ec89a3c78f2a86a5753611d7bb72d95c93`；原登录判断、ready赋值、catch和Toast逐字保留。
- 字体状态可在 `getApp().globalData.referenceFonts` 只读：`support`、`sdkVersion`、`faces[{family,weight,status}]`，另有独立的 `ready` Promise。它不替换登录ready，也不会把字体成功当成身份已准备好。
- 基础库版本从 `getAppBaseInfo().SDKVersion`读取；没有该API时才回退 `getSystemInfoSync`。缺字体API为`unavailable`，不能确认版本/低于3.7.9为`unsupported`，均不发Data URL请求、不新增用户提示。
- 在App初始化作用下，五条准确Data URL使用 `global:true`、`scopes:['webview']`、`desc:{style:'normal',weight:'700'/'400'/'600'/'700'/'800'}`。字体仅影响页面，不改变邀请二维码或既有海报canvas。
- 每条加载独立settle；失败回调或同步异常仅把对应字体标为`failed`，其他字体继续。重复初始化复用已有状态，不重复注册。无await、外部请求、重试风暴或新增用户流程；失败保持已声明的系统fallback。

## family与原稿节点映射

本轮不改字号、行高、字距、字重、布局、按钮绑定、真实文案、status/capsule计算和业务JS。H1–H3的原body没有Jakarta family，故只给明确字体节点/其当前对应容器加family，不给这三页root整页设置。

| 页 | 追加family范围 | 保留边界 |
| --- | --- | --- |
| 首页 | 原`.hero-kicker` / `.feature-tagline`已经是Caveat首选、normal700；只为两条固定英文加载准确700 | `index.wxml`、`index.wxss`、`index.js`本轮均未编辑。正文仍系统sans；☺由系统回退。未加载未使用的Caveat600/400或Marker |
| H About | 原body `font-body-md`对应`.about-page`；明确原生按钮继承同family；header600、品牌800、slogan600、正文400等既有字重不改 | 中文/汉字标点不在原字体cmap时系统回退；纯中文foot500未额外下载Latin500 |
| H1 Release | header、status、WHAT'S NEW、title、intro note/highlight、feature kicker/title/pill、photo caption/label、point heading/body、triplet、optimization point、感谢文与原CTA对应按钮 | 页root/default body与新增menu不被全局改family；R1追加方向卡原无源节点family的note不扩展。原字号与700/600/400保持 |
| H2 Guidelines | header、charter kicker/title/subtitle/values、section heading/tag、rule body/title、quote/正常署名、原末尾交互对应按钮与foot | 中文宣言`italic`和正常署名保持，未引入原HTML没有请求的真斜体字体。普通body/menu仍未整页覆盖 |
| H3 Open source | header、intro标题/英文label/正文、section标签、依赖标题/作者/徽章/说明/实际版权、致谢头/条目、仓库标题/地址/按钮、复制结果和末尾英文 | 当前许可摘要`.license-note`未被覆盖。原三段虚构项目MIT mono正文已在此前删除，本轮未恢复；没有将它作为加载Jakarta的依据 |

family回退统一为准确Plus Jakarta Sans，随后系统 `-apple-system / BlinkMacSystemFont / PingFang SC / Hiragino Sans GB / sans-serif`。CJK/☺不因缺glyph而伪造新字形。中文fallback和其字体样式仍需root实际截图确认，family字符串不是视觉证明。

H3当前真实清单是root独占的WXML变更：增加Caveat、Plus Jakarta Sans两条已实际采用的OFL-1.1字体，同时补列此前真实使用的Phosphor图标，计数为5项依赖/2项图标资源/2项字体资源。字体实现者只报告准确maker/版权/许可路径，未改该WXML或H3业务JS；root须单独记录清单源码与UI证据。

## 准确资源与许可

详尽URL/请求UA/CSS/hash/字体name与实际weight/cmap在 `docs/design-sources/reference-fonts/source.json`。其Google Fonts metadata与许可固定在官方仓库commit `9710da1eacb3be272583c3224dcb70f9da6eadbb`；WOFF是原样保存的官方CSS2服务响应，而不是冒称该git commit里的WOFF blob。没有改二进制或自行实例化可变字体。

| 原样WOFF，只保留在docs来源证据中 | API weight | bytes | SHA-256 |
| --- | --- | --- | --- |
| `caveat-700-home.woff` | Caveat700 | 18,280 | `736ba5632b23a1aa7381201b8328be3ea3e286b8ede8545667f7fd6e2fbab19e` |
| `plus-jakarta-sans-400.woff` | Jakarta400 | 28,828 | `3ec7f5cad1bd738387a7c9b7e18428cfb165e9b98bdd26645b9f58fceee492c0` |
| `plus-jakarta-sans-600.woff` | Jakarta600 | 29,604 | `918ce7b19d036bcd59d41ab6198bbf35d77cf46227e56b85274e1dd2522ca8be` |
| `plus-jakarta-sans-700.woff` | Jakarta700 | 29,828 | `4f3f2b563317bc9b948f8aef3c24e01cbc11f342015eaf827f45533f8986d896` |
| `plus-jakarta-sans-800.woff` | Jakarta800 | 29,132 | `7036e01f13e5c43a877d1d0db05f4dda5ba8f76641a64f1c137fa58170b48632` |

字体135,672 B仅在产品资源模块编码一次为180,904 B Base64，未在小程序目录再复制五个WOFF。最终资源模块190,570 B，包含两份完整原OFL版权/许可文本各一次；许可作为 `module.exports.licenses` 文本属性保留，不只作为可能被编译删除的注释。docs许可原文仍原样保留：Caveat4,385 B/hash `1f9d81d094273d82f3898a1ee8b598a717d050ecbf5ff7bede105b704880157b`；Jakarta4,402 B/hash `995c7199cab65954f545996326755daee7b63cc6b42b06c13da1f9502ab08a99`。

当前产品文件源码增加194,258 B。Wave64主包由root提供1,854,382 B，因此按源码增加简单相加约2,048,640 B/余48,512 B；**这只是算术，不是最终编译包尺寸**。实际preview和2 MiB门禁由root核验。docs原字体/许可/元数据不计入主包；不关闭大小检查。

## 唯一一轮必要初始化VM

命令：bundled Node运行 `/private/tmp/caper-wave65-fonts/check-initialization.cjs`。一次执行，退出0；使用实际App/loader/资源模块，只在不能于Node使用的原生wx与登录边界提供受控stub。测试目的为发现字体加载导致登录未启动、错误状态互相污染、旧SDK收到不支持的Data URL及重复注册；没有测试CSS字符串或重写视觉实现。

| 分支 | 字体调用 / loaded / failed | 认证结果 |
| --- | --- | --- |
| 正常成功 | 5 / 5 / 0 | 原login先启动，字体未完成前无需等待；auth ready仍独立，之后正常完成 |
| 单字体失败 | 5 / 4 / 1 | 同上；其他四个成功 |
| 基础库3.7.8 | 0 / 0 / 0 | 同上；unsupported不发送Data URL |
| 缺loadFontFace API | 0 / 0 / 0 | 同上；unavailable保持fallback |
| 第一个字体原生API同步抛错 | 5 / 4 / 1 | 同上；异常只影响对应字体 |

正常/失败/异常路径同时校验真正送到原生边界的五条Data URL解码SHA与官方文件一致、准确family/单一weight、normal、global和仅webview；成功后再调用loader返回相同状态且没有新增注册。没有拿stub返回loaded当微信真实字体成功。

VM检查时字体字节、五条数组、App和loader与最终完全相同；随后只将两份OFL从注释移为数组模块的额外`licenses`属性，未动字体条目或初始化逻辑。为该后续文本变更单独核验两份导出字符串与原文件逐字相等、font数组仍5条，没有重复五个初始化分支。结果JSON留在独占temp的 `initialization-check.json`；不新增项目样式镜像测试或跑全量/CI。

源码范围核验：原登录分支完整hash不变；公共app.wxss/common.wxss与首页WXSS三文件hash不变；H四页业务JS四文件hash与Wave62基线一致。这些是有限源码保留检查，不是全项目业务回归通过。

## 冻结交接

| 产品文件 | bytes | SHA-256 |
| --- | --- | --- |
| `miniprogram/app.js` | 556 | `540105f1b42f5695519da2f36e4bf8e3399cbecdfc2347ffb0838965e04fce69` |
| `miniprogram/utils/reference-fonts.js` | 1,853 | `ad556963f34c48a49d7cdf6b04c8d2f4fe02f6e38ae655d5e2dfd3416a45c33a` |
| `miniprogram/utils/reference-font-data.js` | 190,570 | `7a33f0b38e9b273ad07ed34cd3648cf8702a299c6ce6471224d04c920784cd63` |
| `miniprogram/pages/about/about.wxss` | 9,629 | `5f47852e4fe9046b035a29d977528e910ed78858ad0ba829e71c06b0f90235cc` |
| `miniprogram/subpackages/profile/release-notes/release-notes.wxss` | 10,357 | `3e49800ed01f8e1e8d087a50d045943cb37e18dcf70dabd14088c8d6b6878767` |
| `miniprogram/subpackages/profile/guidelines/guidelines.wxss` | 8,907 | `588fbf20efbf5d9d39cb0e9cef585c4c13223a0b3a8bbba601339956b4c06254` |
| `miniprogram/subpackages/profile/open-source/open-source.wxss` | 6,965 | `e805501ed7201b60380ef136850465792ff46285149e9582076f5bbca1e945cc` |

source.json冻结SHA `2128773f810dff3a4a4b3fa4c51874d8105f954efa298c7ee364a9ee7dc73d6c`。完整19个应用/来源/许可文件冻结字节与hash在 `/private/tmp/caper-wave65-fonts/frozen-product-and-source-hashes.json`；本实施报告是随后撰写的独占文字。

产品加载已实现，受控初始化五分支通过；独立复核、真正微信登记/字形/布局/胶囊、最终包体、凭证发布检查与Git上传由root继续。真机、全39页像素一致、字体所有失败平台及正式发布未验收。实现者没有操作微信、CLI、Git、共享验收矩阵或其他业务文件。
