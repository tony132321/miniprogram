# Wave65 原稿字体缺口：只读调查与准确资源候选

本文件按父任务约定保留 `2026-10-01` 文件名；调查与资源核验完成于 **2026-10-02 02:32（Asia/Shanghai）**。范围为 Wave64 首页首屏两条手写文案与 Wave62 H / H1 / H2 / H3 四页的原稿字体。只写本报告、独占 `/private/tmp/caper-wave65-fonts/` 调查文件；没有改产品、公共 JS/CSS、测试、共享验收矩阵，没有操作微信、CLI 或 Git。以下是源码和字体文件核验，**不是已加载或字形视觉验收**。

## 1. 已确认的缺口

- `miniprogram/app.js` 只有既有登录初始化；全工程 JS / WXSS 搜索没有 `wx.loadFontFace` 或 `@font-face`，也没有 TTF / OTF / WOFF / WOFF2 产品文件。
- Wave64 首页 `index.wxss:308` / `:338` 已正确声明 `Caveat, Permanent Marker, cursive, sans-serif`，但没有加载字体。声明 family 不能证明实际使用 Caveat。
- H 四页现有页 CSS、`profile/common.wxss`、`app.wxss` 均未声明 Plus Jakarta Sans；字号和字重已恢复，family 仍是环境默认值。
- 原字体不含汉字，也不含 `☺`。这些字应保留原稿的系统回退；不能为“所有文字都使用原字体”而另造中文字体，或将预期回退误报为加载失败。

读到的产品快照：`app.js` SHA-256 `a5698428315a8a76bfcf8140151468ec89a3c78f2a86a5753611d7bb72d95c93`；首页 WXSS `5fd04b24883cc3a89188e989e4d04f9ba70ece8d4d9f88916380e07dfceb6aa0`。其余四页 CSS 与 Wave62 最终 source snapshot 一致；完整只读字节/hash 在 `/private/tmp/caper-wave65-fonts/repo-read-snapshot.json`。

## 2. 原稿实际 family / weight / style

原 HTML 与 PNG 位于 `/private/tmp/irl-stitch-original/stitch_design_system_generator/`，来源仍是用户提供的压缩包。以下基于 HTML 的实际声明，不把链接中所有可选字重都当成当前必用字重。

| 原稿 | 字体引用与实际节点 | 最小当前需求 |
| --- | --- | --- |
| `caper_2` 首页 | 第40行引用 `Caveat:wght@600;700` 与默认 `Permanent Marker`；Tailwind `hand` family 首选 Caveat、Marker 为回退。第130行 `More People, Brighter Days ☺` 与第218行 `Same Game & New Friends` 均 `font-hand font-bold`，normal / 700；正文 `sans` 是系统字体栈 | 首屏仅 Caveat 700；不把整个首页改成 Jakarta。Marker 在 Caveat 正常加载且所需英文已覆盖时没有必需字形，不必为了回退额外加载 |
| H `pg10_h_project_irl` | 第3行 Jakarta 400 / 500 / 600 / 700 / 800；第5行另有100..900请求。body 明确 `font-body-md`；真实字号配置为 body400、headline600、display800、label600/700；一个 `font-medium` 公司版权节点是汉字 | normal 400 / 600 / 700 / 800 足够当前实际英文/数字；500节点当前纯中文，不需要为它额外取Latin500。原100..900请求不能证明官方字体有100或900 |
| H1 `pg10_h_1` | 第3行 Jakarta normal 400 / 600 / 700 / 800。body **没有** Jakarta family class；标题、正文、label等实际 `font-headline-* / font-body-* / font-label-*` 节点有 family，额外 `font-bold / font-semibold` 按源码覆盖字重 | 400 / 600 / 700；不因链接包含800就声称H1有必用英文800 |
| H2 `pg10_h_2` | 同H1引用；显式 headline/body/label 节点用 Jakarta；第210行中文宣言有 `font-headline-sm text-headline-sm italic`，600/italic，但引用只请求 normal 字体 | normal 400 / 600 / 700。原网页本就未请求真斜体文件；保留现有中文宣言 italic 与正常署名，不额外下载无使用依据的 italic |
| H3 `pg10_h_3` | 同H1引用；header/headline600、正文400、label600/700。原第155 / 158 / 161行虚构项目通用许可正文另有 `font-mono`，不是 Jakarta | 400 / 600 / 700。当前产品已删去不真实的通用项目许可正文；若未来展示实际完整许可，不以全局Jakarta覆盖原mono语义 |

H / H1 / H2 / H3 的明确 typography role：`body-md` 15px/21px/400、`body-sm` 13px/18px/400、`headline-sm` 17px/22px/600、`headline-lg-mobile` 22px/28px/700、`display-mobile` 28px/36px/800、`label-lg` 15px/20px/600、`label-md` 13px/16px/600、`label-sm` 11px/14px/700。只加准确 family，保留已经验过的字号、行高、字距、真实文案与按钮行为；H1–H3不能未经节点映射直接声称整页默认family都来自原稿。

首页完整原稿还有第348 / 527 / 592 / 679行四处 `font-hand`，前三处700，末尾一处未声明粗体。它们不属于 Wave64 首屏两条恢复范围；**此处准备的 text 子集只保证当前两条英文**。后续恢复其他手写节点时须扩充字符与对应字重，不能把本调查当成全首页手写字体已齐全。

原稿 SHA-256：

| 目录 | code.html | screen.png |
| --- | --- | --- |
| `caper_2` | `e4e4ba417711e27838f10cef098c4da8c428d3b9d7c4217fe36d9def5761c4ca` | `81028ecae6d89d2b77c70750e628c1e58a355dd52704e2a3646dcf392934f13f` |
| `pg10_h_project_irl` | `e29a2c86dc0f3584009a8b37268fba472325ff5f748c65df4e886881a815bad9` | `eaa063182ba0a61e2a7b7d0cc649d24730a6152557cfd063a9c8bd62ebed6a1d` |
| `pg10_h_1` | `ef395c24605f58944d0e7e962fbd36735d0712adc0a57271015363e7b7ef4824` | `f794a8dceeae1eaf35b77875be67a4ce06d7f26423141af93f6c187f2fe13ade` |
| `pg10_h_2` | `0a7871c7b3ab496e593b9f41cc493b711160c43dbcc4932debb5afbfd81b3fc0` | `5f3d160c6f91b4025bfe68b5016853492992396dbd219c8cfa24abca9b99e212` |
| `pg10_h_3` | `1375e6dbe0acb545c85553314dbea919eee7b8054136e149074ddae612089b0a` | `29afed29a2d39bd2636199f41ef6848b00802ebf648d5bcdeccc754b6f46b362` |

## 3. 已保存的官方来源与最小静态资源

Google Fonts 官方仓库固定在 [`9710da1eacb3be272583c3224dcb70f9da6eadbb`](https://github.com/google/fonts/tree/9710da1eacb3be272583c3224dcb70f9da6eadbb)。官方 `METADATA.pb`、许可及原始字体全部保存在独占 temp 文件夹，没有复制进产品。Caveat 上游固定 `59745e818ef7973e11e70cb1358d0e902b56c5fc`；Jakarta 上游固定 `18d1cd2f7ea10481919d2f05c1f7064b7307fc26`，来自本次实际取得的 metadata，未依据第三方转述。

官方源码文件检查结果：Caveat `Version 2.000`、wght400..700、403,648 B；Jakarta `Version 2.071;gftools[0.9.30]`、wght200..800、176,288 B；Marker `Version 1.001`、static400、74,632 B。**Jakarta实际范围不支持100/900**。三个文件都无汉字/☺；源文件只证明公开字形资源与family，不能证明导出截图当时浏览器成功加载了相同文件。

为了减少包体并避免把可变字体范围误当成微信API已验证能力，另外读取官方 Google Fonts CSS2，保留完整URL、请求 User-Agent、响应CSS与原始字体字节。使用官方 [CSS2明确字重及 `text=` 优化](https://developers.google.com/fonts/docs/css2)；Chrome 23 User-Agent让服务返回静态 **WOFF**。以下五个文件均HTTP200、MIME `font/woff`、CORS `*`，用现有 FontTools 只读打开核验真实字重、name/version、cmap、无fvar；沒有自行实例化/造字体/改字体字节。

| 优先候选，均在 `/private/tmp/caper-wave65-fonts/` | 字重 / 覆盖 | 字节 / Base64字符字节 | SHA-256 |
| --- | --- | --- | --- |
| `caveat/official-home-text-woff-1.woff` | Caveat Bold700；27个Unicode字符/76glyph；两条当前固定英文的全部字符，包括空格、逗号、`&`，不含☺ | 18,280 / 24,376 | `736ba5632b23a1aa7381201b8328be3ea3e286b8ede8545667f7fd6e2fbab19e` |
| `plusjakartasans/official-woff-4.woff` | Jakarta normal400 | 28,828 / 38,440 | `3ec7f5cad1bd738387a7c9b7e18428cfb165e9b98bdd26645b9f58fceee492c0` |
| `plusjakartasans/official-woff-3.woff` | Jakarta normal600 | 29,604 / 39,472 | `918ce7b19d036bcd59d41ab6198bbf35d77cf46227e56b85274e1dd2522ca8be` |
| `plusjakartasans/official-woff-2.woff` | Jakarta normal700 | 29,828 / 39,772 | `4f3f2b563317bc9b948f8aef3c24e01cbc11f342015eaf827f45533f8986d896` |
| `plusjakartasans/official-woff-1.woff` | Jakarta normal800 | 29,132 / 38,844 | `7036e01f13e5c43a877d1d0db05f4dda5ba8f76641a64f1c137fa58170b48632` |

这四个 Jakarta WOFF各有721 Unicode字符/781glyph，涵盖Latin及官方已有其他非CJK字形；不是只含ASCII的激进子集。©、·、长短破折号、弯引号、•、→均在实际cmap里。源CSS给它们统一 `font-family:'Plus Jakarta Sans'` 和对应 weight；内部600/800带不同subfamily名称，加载时仍应以API显式family + desc.weight绑定，不能按文件序号猜字重。

WOFF provenance在 `woff-candidate-sources.json`；字符表/版本/字重结果在 `woff-inspection.json`。首页准确请求为 [Caveat700，当前固定英文 text](https://fonts.googleapis.com/css2?family=Caveat%3Awght%40700&display=swap&text=More+People%2C+Brighter+Days+Same+Game+%26+New+Friends)；Jakarta准确请求为 [normal400/600/700/800](https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans%3Awght%40400%3B600%3B700%3B800&display=swap)。**服务会按User-Agent协商格式**，这些CSS链接不是直接可用的字体二进制地址；确定字节应使用JSON中已记录的gstatic最终URL及hash。

额外调查候选有现代Chrome返回的Latin WOFF2（Caveat51,068 B、Jakarta27,272 B、Marker29,296 B），以及IE8返回EOT。EOT不进入建议方案；WOFF2不按已验证旧iOS兼容处理。当前Python未安装Brotli，WOFF2仅校验响应/hash，没有宣称已解析其cmap。转用官方静态WOFF后已完成cmap检查，未安装新依赖。Marker、variable TTF、EOT、WOFF2全部只在temp候选缓存，产品没有加载它们。

## 4. 许可、包体与R1加载路线

### 许可留存

- Caveat与Jakarta为OFL1.1；保存原版权与完整许可，分别 [`ofl/caveat/OFL.txt`](https://github.com/google/fonts/blob/9710da1eacb3be272583c3224dcb70f9da6eadbb/ofl/caveat/OFL.txt) / [`ofl/plusjakartasans/OFL.txt`](https://github.com/google/fonts/blob/9710da1eacb3be272583c3224dcb70f9da6eadbb/ofl/plusjakartasans/OFL.txt)。文件为4,385 / 4,402 B；SHA-256分别 `1f9d81d094273d82f3898a1ee8b598a717d050ecbf5ff7bede105b704880157b` / `995c7199cab65954f545996326755daee7b63cc6b42b06c13da1f9502ab08a99`。
- Marker在官方 `apache/permanentmarker` 为Apache2.0；本最小方案不加载它，不把它误写成OFL。若以后实际使用，应携带其许可与实际Font Diner版权来源；下载候选不等于已使用的资源。
- 若后续真正接入，应在实际资源清单/开源致谢中准确增加已用的两类字体与许可，而非宣称使用了整个源页面示例依赖列表。本调查不构成单独法律意见或完整项目许可审计。

### 包体预算

五个静态WOFF合计 **135,672 B**；仅一次Base64编码合计 **180,904 B**，再加JS/manifest/完整许可包装。不要同时在小程序包内存WOFF和相同Base64副本。原始两个variable TTF合计579,936 B，不适合直接塞主包；未优先下载额外500/italic/Marker。

Wave63已完成的编译证据主包1,821,182 B；到2 MiB算术余量275,970 B。若180,904 B Base64全进主包，算术剩95,066 B，**这不是Wave64/65真实编译预算**。Wave64已新增资源，必须由root读取最新preview并在实际接入后核一次包体，不能从旧计数声称仍有充足空间。H四页跨主包/个人分包，资源放置应避免重复五份字体。

### 官方API能力与建议实现顺序

实际读取了 [微信官方 `wx.loadFontFace`](https://developers.weixin.qq.com/miniprogram/dev/api/ui/font/wx.loadFontFace.html)，官方HTML本地hash `da9452ff6f79b85d235039c1fb0ab73da53b1d111d8fdff38c94120439a234de`。官方API声明及同一说明亦来自 `wechat-miniprogram/api-typings`；没有依据论坛猜测本地 `wxfile://` 支持。

1. 原稿已确定，先接入 Caveat700首屏。基础库 **3.7.9起**官方明确支持Data URL，可将准确WOFF只编码一次，通过 `source:'url("data:font/woff;base64,...")'`，`family:'Caveat'`、`desc:{style:'normal',weight:'700'}`；不需要为了代码级字体加载等待用户提供HTTPS域名。当前已验过的模拟基础库3.17.2/3.17.3高于此能力版本，但本调查没有重新启动工具核验。
2. 若全局加载，官方要求自基础库2.10.0起在 **app.js** 调用且 `global:true`。共享初始化必须由root串行协调；不得阻塞既有登录/活动请求或让失败页面空白。显式 `scopes:['webview']` 将此批字体作用限制在页面，避免无意改变既有canvas邀请/海报；Canvas2D需native范围是独立任务。
3. Jakarta按400/600/700/800四条同family+准确desc.weight登记；page/selector准确关联后保留系统中文fallback。官方 `desc.weight` 给出的可选值是单一normal/bold/100..900，本方案不假设它能声明`400 800`变量范围。静态WOFF能减少轴映射不确定性，仍须实际渲染验收。
4. 低于3.7.9须保留系统fallback；若产品明确支持这类客户端，另配置HTTPS字体源。官方要求HTTPS、正确font MIME与同源或CORS（小程序源是servicewechat.com）；不以本机HTTP或仅开发者工具能读的包内/临时路径作真机保证。推荐TTF/WOFF，官方明确旧iOS对WOFF2有兼容风险。
5. 限定字形验证：登记success/status、本地正常/失败fallback、首屏两句实际可见形状与宽度；H分别抽查真实Latin/数字的400/600/700/800、长header截断、长真实许可作者行、Chinese/☺fallback与返回后加载。字体会改变字宽/换行，只重查确实受影响的节点，不跑全量业务/CI。回调成功与CSS family字符串都不是截图字形证据。

## 5. 交接边界

本调查完成：准确源码节点/字重、官方可复用字节、许可/hash、字符覆盖、静态资源预算与官方API路径。产品加载、布局/字形、微信点击、字体失败分支、真实主包编译和真机均**未验收**。报告没有把所有39屏、完整首页手写段落、外部上线或项目完成度列为通过。
