# Wave 67 registration fonts — independent source review

日期：2026-10-02。审查者：`/root/ui64_review`。这是独立源码、字体表和许可字节审查，产品文件未修改。

## 结论及范围

本次冻结的字体模块与 H3 开源资源文案没有发现阻断性源码问题：6 个字体资源；既有四个 Plus Jakarta Sans 资源及两份许可完整保留；Caveat union 保留旧首页字形；新增 Rubik 只覆盖固定标题；完整 Rubik OFL 运行时导出字节与原文相同。新活动入口 helper 的编码、私有提示、重试、过期回调、卸载及返回逻辑也未发现本次正常入口契约内的阻断问题。

本报告不作微信字体已加载、分包入口已接通、截图像素一致、主包已符合限额、真机或全部页面验收通过的结论。没有执行 Git、微信 CLI/SDK/CUA、全量测试、CI，也没有重复运行 root 的活动入口测试。

## 输入、基线和方法

- 基线：root 确认的 Wave 66 提交 `a8486175a3bfb3a70f475725b4901d1cf9de603b` 的不可变目录 `/private/tmp/caper-ui66-immutable-rt5d0gtu`。审查直接读取该目录，没有调用 Git。
- 当前字体：`miniprogram/utils/reference-font-data.js`，193256 B，SHA256 `486de055ed7ecb35f165fcac8546c9cd916fc21a563b09803f59693c3c7ec7c8`。第二行只补充 `registration-fonts` 来源注释；导出资源和许可在注释更新前已核验，注释更新后核冻结文件哈希。
- 官方归档：`docs/design-sources/registration-fonts/source.json`、其 2 份 CSS、2 份 WOFF、Rubik OFL、字体 metadata，以及 `/private/tmp/caper-wave67-event-prep/manifest.json`。Google Fonts metadata/许可固定在官方仓库提交 `9710da1eacb3be272583c3224dcb70f9da6eadbb`。原始 WOFF 和 CSS URL、响应摘要由归档记录提供；本次不重新下载。
- 一次限定核验：Node VM 分别读取旧/新字体导出对象，比较 family/weight/payload、导出许可、H3 绑定和保护文件字节。用已存在的 FontTools 4.60.2 只读解析 WOFF，比较 cmap、`DecomposingRecordingPen` 完整分解轮廓、hmtx 和全局度量。没有安装工具或重编码字体。
- 独占临时记录：`/private/tmp/caper-wave67-font-review/check-font-exports.js`、`check-font-tables.py`、`independent-font-check.json`。两个限定检查退出码均为 0；后者含校正后的实际既有 OFL 文件名，以下结论使用此合并结果。

## 六个字体资源

| family / weight | WOFF 字节 | SHA256 | 独立核验 |
| --- | ---: | --- | --- |
| Caveat / 700 | 19336 | `e587efbee29f5e2239cf3b1e9fc63eaf71e200607b9b84c70226913bddc6cb03` | 与 `caveat-700-home-pg05-union.woff` 原字节相同；旧字形保留见下 |
| Plus Jakarta Sans / 400 | 28828 | `3ec7f5cad1bd738387a7c9b7e18428cfb165e9b98bdd26645b9f58fceee492c0` | family、weight、完整 Base64 payload 与基线逐字节相同 |
| Plus Jakarta Sans / 600 | 29604 | `918ce7b19d036bcd59d41ab6198bbf35d77cf46227e56b85274e1dd2522ca8be` | 同上 |
| Plus Jakarta Sans / 700 | 29828 | `4f3f2b563317bc9b948f8aef3c24e01cbc11f342015eaf827f45533f8986d896` | 同上 |
| Plus Jakarta Sans / 800 | 29132 | `7036e01f13e5c43a877d1d0db05f4dda5ba8f76641a64f1c137fa58170b48632` | 同上 |
| Rubik Mono One / 400 | 4040 | `36faf220f9935cff89be4b5611a337202dc2a95be07df3565594ce6208c4285a` | 与 `rubik-mono-one-400-pg05.woff` 官方归档原字节相同 |

旧模块为 5 个资源，186228 B，SHA256 `6ffecd68c01d0586544263e1b97426f71f425bdc71c98635b5c4c71209c3ce08`。新模块只增加 Rubik 资源、替换 Caveat 为首页与 PG05 文案 union，并增加其许可和来源注释。它没有增加 Jakarta 500 或 italic 文件；不能由六资源计数推断原稿所有字体重量都已原生加载。

### Caveat：首页字形保留

旧 Caveat WOFF 18280 B，SHA256 `736ba5632b23a1aa7381201b8328be3ea3e286b8ede8545667f7fd6e2fbab19e`；union 19336 B。新字体为 Caveat / Bold，OS/2 weight 700，Version 2.000，没有 fvar axis，italicAngle 0，italic flag false。

- 旧 cmap 27 个 Unicode 全部包含于新 cmap 28 个 Unicode；唯一新增码位为 `U+0052`（R）。旧 76 glyph、新 79 glyph；glyph 数包括复合字形组件，不能等同 Unicode 数。
- **27 个共同 Unicode 的完整分解轮廓命令序列及各自 hmtx advance/LSB 全部精确相同**。不是仅以字体名称或 hash 推断旧外形保留。
- 全局度量也逐项相同：UPM 1000；hhea ascent/descent/lineGap = 960/−300/0；OS/2 typo ascent/descent/lineGap = 960/−300/0；WinAscent/WinDescent = 974/315。
- 请求固定文案 `More People, Brighter Days Same Game & New Friends Good People Great Rallies` 的所有字符都有 cmap。旧首页的 ☺ 原本不在字体 subset 中，仍依赖系统回退；本检查不把它列为 Caveat 字形。

该结果证明旧共同码位的轮廓和度量保留，不证明所有 shaping table、微信字体加载、中文回退、合成样式或实际设备栅格化逐像素相同。

### Rubik：固定英文标题

字体表独立读得 Rubik Mono One / Regular，OS/2 weight 400，Version 1.001，无 fvar axis，italicAngle 0，italic flag false。cmap **恰为 13 个 Unicode**，即 `BADMINTON TOGETHER` 的唯一字符：空格和 A、B、D、E、G、H、I、M、N、O、R、T；14 glyph 包含 `.notdef`，没有扩大为数字、中文或任意新标题。原稿 italic 使用 CSS 合成，资源本身是官方 normal 400。

## 完整许可字节

| 运行时导出许可 | UTF-8 字节 | SHA256 | 与原文/基线的关系 |
| --- | ---: | --- | --- |
| Caveat | 4385 | `1f9d81d094273d82f3898a1ee8b598a717d050ecbf5ff7bede105b704880157b` | 与旧导出及 `docs/licenses/caveat-OFL-1.1.txt` 完全相同；93 个 LF、0 CRLF |
| Plus Jakarta Sans | 4402 | `995c7199cab65954f545996326755daee7b63cc6b42b06c13da1f9502ab08a99` | 与旧导出及 `docs/licenses/plus-jakarta-sans-OFL-1.1.txt` 完全相同；93 个 LF、0 CRLF |
| Rubik Mono One | 4462 | `43d530580461a574f6dfed9e15af6a74e95f7c04d9bfa1174a63ff036e8eee07` | 与 `docs/design-sources/registration-fonts/rubikmonoone-OFL.txt` 完全相同；93 个 CRLF、0 单独 LF |

Rubik 使用正确的 2015 年 Rubik Project copyright header，并将旧 `OFL_COMMON_BODY` 的 LF 转为 CRLF。执行模块后取得的完整文本逐字节比较通过，包含原文空白、换行及尾部；没有以“共用 OFL 正文”代替完整文本相等的证据。这是来源和字节检查，不是法律审计。

## Loader、app 与 H3 保护

以下文件与不可变 Wave 66 基线完全相同：

| 文件 | 字节 | SHA256 |
| --- | ---: | --- |
| `miniprogram/app.js` | 556 | `540105f1b42f5695519da2f36e4bf8e3399cbecdfc2347ffb0838965e04fce69` |
| `miniprogram/utils/reference-fonts.js` | 1853 | `ad556963f34c48a49d7cdf6b04c8d2f4fe02f6e38ae655d5e2dfd3416a45c33a` |
| `miniprogram/subpackages/profile/open-source/open-source.js` | 1545 | `a6833658f2968a2ecb3fdf9fd2d84748d3a8ef93930bdacdac37b7efec063393` |
| `miniprogram/subpackages/profile/open-source/open-source.wxss` | 6965 | `e805501ed7201b60380ef136850465792ff46285149e9582076f5bbca1e945cc` |
| `miniprogram/subpackages/profile/open-source/open-source.json` | 72 | `84b4b1556762d732687e0f9738b40154ddcb1927518c42c86533cab371192128` |

Loader 仍使用 SDK 3.7.9 数据 URL 支持门槛、一次缓存状态、`Promise.all`、normal style 和各资源 weight、global/webview scope，以及失败状态处理。文件不变证明本次没有改加载契约，不能证明运行时六个 `wx.loadFontFace` 请求均成功。

H3 WXML 为 7956 B，SHA256 `71e8bb28a33e37fc7e7e2daef1f263027b6d0779c134cbd1c42668b2c7fc4a9d`：

- 实际 `dependency-title` 共 **10** 项，与“10 项资源”一致：pg、PGlite、TypeScript、tsx、qrcode-generator、Material Symbols、Phosphor Icons Web 2.0.3、Caveat、Plus Jakarta Sans、Rubik Mono One。基线实际为 9 项。
- Caveat、Jakarta、Rubik copyright 年份、作者和来源与相应保留许可一致；描述分别说明首页/报名海报固定手写、英文数字及中文回退、报名海报固定英文标题。
- 旧/新完整提取的 15 个绑定和控制属性序列相同，包括 bind/catch、data、wx 条件、aria、open-type、decode、disabled、id；已有返回、分享、更多、个人、关于、复制仓库及消息条件保持。H3 JS/WXSS/JSON 不变。
- 本次没有 H3 运行时截图或十项卡片渲染验收。

## 新活动旧入口 helper：独立只读补审

读取 `miniprogram/utils/event-entry.js`（1633 B，SHA256 `4fea7123ae8f9211d6a6ae9bc3aecb1f8a6611ac070f77b3225967e65ab1276f`）及 `test/event-entry.test.ts`（3999 B，SHA256 `4af0b8f5a8cbd8d3fff9cae96611e12953c7bf755732d373b0c4bf5d28aa3a51`）。root 已报告 6 个定向测试通过；本审查没有重复运行，以下是源代码和测试覆盖的独立核对。

| 契约 | 源码审查结果 |
| --- | --- |
| 固定目标和参数 | 目标固定为 `/subpackages/activity/event/event`。对所有 primitive string/number/boolean key 与 value 分别 `encodeURIComponent`，保持 token、id、source、section、entry、success、空字符串、Unicode 和保留字符；对象/函数等不转发。查询不能替换目标路由或通过 `&` 引入额外参数。原 event `onLoad` 使用相同命名值，并在业务页继续验证身份、活动及状态。 |
| 入口隐私 | 邀请查询仅存在私有 `_target`，不写入 `data`、日志或 storage。失败忽略 native errMsg，只显示固定“活动页面加载失败，请重试。”；不会把 native error 中 token 返显。实际业务 event 页面既有处理不由此 helper 绕过。 |
| 重试与重复点击 | `_navigating` 阻止请求进行中重复发起；失败后置 false，可用同一 `_target` 重试。同步 redirectTo 异常进入同一个通用失败处理。 |
| 过期回调 | 每次请求递增 `_request`；fail 必须同时满足 `_active` 及相同 request，旧重试 fail 不覆盖新 loading 状态。 |
| 卸载 | `_active=false`、递增 request 并清空 `_target`；late fail/retry 不更新数据或再次导航。 |
| 返回 | 已有栈 `navigateBack(delta:1)`，直接入口或返回失败回 `/pages/index/index`；回退 callback 检查 `_active`。目标未从用户查询取得。 |

测试源码对应上述 6 类真实行为，检查 reserved/Unicode roundtrip、错误隐私、retry、重复/过期、unload、stack/direct/back-fail 及同步导航异常；不是样式镜像。一般可由微信 URL 入口形成的正常 query 未发现编码或回调阻断。

边界：helper 尚须 root 的实际路由迁移、app 分包注册及页面 wrapper 绑定完成后才能给出“入口已接通”结论。本次没有模拟原生分包下载、返回与 redirectTo 并发的导航栈或网络失败；私有 `_target` 必须交给微信路由用于导航，不等于 token 不存在于 native route。`encodeURIComponent` 不能编码孤立 UTF-16 surrogate，该不属于本次正常 URL query 的已验证输入，不能据本审查声称接收任意内存字符串。

## 未覆盖的验收

原生六字体加载状态、固定海报上的合成 italic、Caveat/Jakarta/CJK 回退、H3 实际渲染、所有 39 页面像素、native safe area、最终主/分包编译预算、旧入口真实分享与分包加载返回链路，均由对应后续有限运行验收提供。本报告仅对上述冻结源码及归档字节负责。
