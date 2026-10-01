# Wave65 原稿字体接入独立复核

日期：2026-10-02。基线计划 `6cf710ee750000d32639e5649466620bec2d6dac`。**独立源码与资源审查：通过，无阻塞发现。** 已核root冻结的19路径、最终loader/App/CSS、五个产品Base64 face与完整OFL导出、H3最终9张资源卡及首页/发现showModal修改兼容性。本复核者没有修改应用、业务、微信工具、Git或总验收，没有运行全量/CI或重跑15项业务测试。该结论不包含微信实际字形、真机或39屏全字体验收。

## 独立核验方式

已完整读 accepted `2026-10-02-reference-fonts.md`、字体只读审计、五个原稿HTML与整张PNG。FontTools4.60.2通过先前只读 `/private/tmp/irl-material-symbols-wave60/fonttools` 使用，Python为bundled绝对runtime。复核没有安装依赖、生成或更改字体字节。对五个审计候选，从记录的各精确 gstatic URL 重新读取官方二进制，逐字节与已留存WOFF比较，再独立打开font检查OS/2 weight、name/version、fvar与cmap，而非仅接受实现者manifest。两份OFL同样从固定Google Fonts commit官方raw文件重新读取并核对。

## 原稿身份及family节点边界

| 原稿 | HTML SHA-256 | PNG SHA-256 |
| --- | --- | --- |
| `caper_2` | `e4e4ba417711e27838f10cef098c4da8c428d3b9d7c4217fe36d9def5761c4ca` | `81028ecae6d89d2b77c70750e628c1e58a355dd52704e2a3646dcf392934f13f` |
| `pg10_h_project_irl` | `e29a2c86dc0f3584009a8b37268fba472325ff5f748c65df4e886881a815bad9` | `eaa063182ba0a61e2a7b7d0cc649d24730a6152557cfd063a9c8bd62ebed6a1d` |
| `pg10_h_1` | `ef395c24605f58944d0e7e962fbd36735d0712adc0a57271015363e7b7ef4824` | `f794a8dceeae1eaf35b77875be67a4ce06d7f26423141af93f6c187f2fe13ade` |
| `pg10_h_2` | `0a7871c7b3ab496e593b9f41cc493b711160c43dbcc4932debb5afbfd81b3fc0` | `5f3d160c6f91b4025bfe68b5016853492992396dbd219c8cfa24abca9b99e212` |
| `pg10_h_3` | `1375e6dbe0acb545c85553314dbea919eee7b8054136e149074ddae612089b0a` | `29afed29a2d39bd2636199f41ef6848b00802ebf648d5bcdeccc754b6f46b362` |

- `caper_2:130/218`：仅当前两条固定英文 `More People, Brighter Days ☺` / `Same Game & New Friends` 的 `font-hand font-bold`，首选Caveat700 normal。原hand stack为Caveat / Permanent Marker / cursive / sans-serif。当前准确subset覆盖两个英文全部字符，☺无glyph须系统fallback。原另四hand节点348/527/592/679不由这两句subset完成。
- H `pg10_h_project_irl`：body显式 `font-body-md` 使默认family继承Jakarta；Project IRL主标题display-mobile800，版本body-sm400，Manifesto标签label-sm700、标题headline-sm600、描述body-sm400，其他label-md600等依原role。
- H1–H3：body没有Jakarta family；原明确 `font-headline-* / font-body-* / font-label-*` 的节点才有该family，不能直接把整页默认Jakarta视为逐节点映射。H1额外font-bold/semibold覆盖按真实节点保留。
- H2:210：中文宣言headline-sm600带italic；源请求只有normal，原本没有加载独立italic文件。保留现有中文italic和署名常规，不增无依据font文件。
- H3:155/158/161源通用项目许可正文另用font-mono；产品已删除这段虚构许可，不恢复或用Jakarta覆盖原mono。当前新增实际组件/字体版权作为事实摘要，与示例项目许可不同，不据此称原全部正文复制。

## 官方字节与真实weight复核

五个gstatic远程响应均与审计留存bytes完全相同，MIME font/woff、CORS*。全部没有fvar；Caveat Version2.000，Jakarta Version2.071;gftools[0.9.30]。CSS对应font-weight与真实OS/2一致，文件编号不代替weight判断；Jakarta600/800内family分别带SemiBold/ExtraBold，而登记需统一显式Plus Jakarta Sans family与准确desc.weight。

| 文件内部family | weight/style | 原始bytes | Base64 bytes | SHA-256 |
| --- | --- | --- | --- | --- |
| Caveat | 700 normal | 18280 | 24376 | `736ba5632b23a1aa7381201b8328be3ea3e286b8ede8545667f7fd6e2fbab19e` |
| Plus Jakarta Sans | 400 normal | 28828 | 38440 | `3ec7f5cad1bd738387a7c9b7e18428cfb165e9b98bdd26645b9f58fceee492c0` |
| Plus Jakarta Sans SemiBold | 600 normal | 29604 | 39472 | `918ce7b19d036bcd59d41ab6198bbf35d77cf46227e56b85274e1dd2522ca8be` |
| Plus Jakarta Sans | 700 normal | 29828 | 39772 | `4f3f2b563317bc9b948f8aef3c24e01cbc11f342015eaf827f45533f8986d896` |
| Plus Jakarta Sans ExtraBold | 800 normal | 29132 | 38844 | `7036e01f13e5c43a877d1d0db05f4dda5ba8f76641a64f1c137fa58170b48632` |

合计原WOFF135672B、Base64180904B。Caveat27 Unicode/76glyph；四Jakarta各721 Unicode/781glyph。两类均没有CJK汉字和☺，故原中文/☺系统fallback正常。Caveat两句所需英文字符缺失0；四Jakarta覆盖源版权作者及常见标点，不需额外500/italic/Marker/variable资源。

精确URL及远程比对结果在本次只读temp记录 `/private/tmp/caper-wave65-font-review/source-check.json`。最终 `docs/design-sources/reference-fonts/source.json` 已永久保存CSS请求/UA、每face精确URL、weight、cmap、hash、版本与版权。最终产品数组恰有上述五face，独立require后逐个Base64解码，五项bytes/hash均等于本复核重新读取的官方字节及最终docs WOFF；没有转码、字形修改或权重替换。产品包内未发现独立WOFF/TTF/OTF副本。

依据[官方Google Fonts CSS2](https://developers.google.com/fonts/docs/css2)的准确weight与text请求；微信[官方loadFontFace](https://developers.weixin.qq.com/miniprogram/dev/api/ui/font/wx.loadFontFace.html)的审计保留完整HTML和官方声明可读正文已复核：3.7.9开始Data URL，global2.10.0起且app.js调用。最终源码符合这些边界：SDK至少3.7.9才加载、`global:true`、`scopes:['webview']`、准确normal与字符串weight，App在登录初始化后独立调用。源码符合不代表实际API回调或字形已过。

## 许可与实际资源计数

OFL两份从Google Fonts固定 `9710da1eacb3be272583c3224dcb70f9da6eadbb` 的官方raw重新读取。Caveat4385B/hash `1f9d81d094273d82f3898a1ee8b598a717d050ecbf5ff7bede105b704880157b`；Jakarta4402B/hash `995c7199cab65954f545996326755daee7b63cc6b42b06c13da1f9502ab08a99`。

精确首行版权：Caveat `Copyright 2014 The Caveat Project Authors (https://github.com/googlefonts/caveat)`；Jakarta `Copyright 2020 The Plus Jakarta Sans Project Authors (https://github.com/tokotype/PlusJakartaSans)`。当前root更新的H3有9张实际资源卡：5依赖（pg/PGlite/TypeScript/tsx/qrcode-generator）、2图标（Material Symbols/Phosphor）、2字体（Caveat/Plus Jakarta Sans）。最终短badge「9 项资源」与9卡精确相符；两字体版权及OFL-1.1标识与已核官方文本一致。2字体是family数，5静态face不算5项字体资源。未将原稿Tailwind/Lucide/Confetti/date-fns示例或未实际加载Marker列为新增真实依赖。root在实际H3截图发现长分类计数挤压标题后缩短文案，本复核已读取最终短badge，未操作微信或重复15项断言。

最终 `.licenses.Caveat` 和 `.licenses['Plus Jakarta Sans']` 均为可导出的完整UTF-8原文字符串，各一份；独立编码后的bytes/hash精确等于上述官方OFL和最终docs许可文件，包含版权、前言、定义、条件及免责全文。五字体的加载数组未混入许可对象。

## 最终loader、App及页面节点审查

1. `app.js`去除新增loader require和独立调用两行后，SHA-256精确恢复审计前 `a5698428315a8a76bfcf8140151468ec89a3c78f2a86a5753611d7bb72d95c93`。原storage条件、`api.login().catch`、toast和 `globalData.ready` 无修改。字体状态放在独立 `globalData.referenceFonts`；页面原来等待的登录promise没有被替换、组合或等待字体ready。
2. loader一次登记且调用位置为App onLaunch；缺API、SDK未知/低于3.7.9在require大数据前返回系统fallback。五face登记统一实际family名，`desc.style:'normal'`、weight700及400/600/700/800；每face有独立success/fail结算和同步异常捕获，单项失败不阻止其余登记。没有运行时HTTPS字体下载或对登录promise的依赖。
3. 独立只读复核实现者 `initialization-check.json` 五个VM场景：正常5loaded、单font fail4loaded/1failed、SDK3.7.8不调用、API缺失不调用、单项同步throw4loaded/1failed；每项loginStarted1/authIndependent true。该结果来自真实App/loader/data模块、模拟wx/login边界；本复核未重跑，更未将其当微信callback或glyph证据。
4. 四页原CSS字节全部是最终文件的完整前缀，追加只含family声明与注释；`app.wxss`、首页CSS、profile/common.wxss字节完全相同。故本次没有修改现有字号、行高、字距、布局、weight或中文italic。

| 最终页面/节点 | 已核family范围与weight |
| --- | --- |
| 首页 `.caper-top .home-reference-core .hero-kicker` / `.feature-tagline` | 原两句Caveat首选、700 normal；两份条件render的tagline均为同一句。CSS未改，loader使已有准确family可用。☺系统fallback；其他手写节点不在本次接入范围。 |
| H about | `.about-page`及button继承Jakarta，与原body显式family一致；title800、slogan/标题/操作600、eyebrow/section/徽章700、正文及版本400。现有foot-statement500只有中文，不需新增500英文face。 |
| H1 release-notes | 原明确typography节点：header600、status/WHAT'S NEW/主标题/feature标题与point标题等700、photo-caption600、正文400、footer400及操作700；默认page/common及新未设role的边界说明不强制Jakarta。 |
| H2 guidelines | header/section headline600、charter主标题700、kicker/小tag/英文副标题/底文700、body400、规则title600；英文副标题继承已选family并保留自身700。中文宣言600 italic现有声明保留，署名normal600。 |
| H3 open-source | header/intro title/component标题/thanks/repository/footer600、英文kicker/计数/徽章700、maker/正文/实际版权400；`license-note`排除，source body不强制family，无恢复原删除的mono示例。 |

H3最终9个 `dependency-card` 与「9 项资源」计数一致，实际分类仍为5/2/2；字体名称/作者/完整版权首行与实际加载资源相符。root同时冻结的首页/发现 `showModal` 均为confirmText「去发起」（3字符）和独立fail提示分支；两页没有引用或等待font ready，字体工作没有修改这两个业务模块，二者无冲突。本复核只读检查，不重跑root的15项测试。

## 冻结证据与结论边界

独立以实际bytes重算root19路径冻结清单：19/19大小与SHA-256一致。结果和原CSS前缀/恢复App/hash、五Base64及两OFL导出核验保存 `/private/tmp/caper-wave65-font-review/final-frozen-review.json`。本报告记录源码与官方资源范围通过；主包2MiB预算、微信实际callback、字形shape/换行及真机由root的实际工具证据评定。没有把family字符串、API成功或旧包体余量当字形证明，不代表39屏、整页所有hand节点或正式外部上线验收。

下表是本次独立重算后的冻结文件身份。

| 路径 | bytes | SHA-256 |
| --- | ---: | --- |
| `miniprogram/app.js` | 556 | `540105f1b42f5695519da2f36e4bf8e3399cbecdfc2347ffb0838965e04fce69` |
| `miniprogram/utils/reference-fonts.js` | 1853 | `ad556963f34c48a49d7cdf6b04c8d2f4fe02f6e38ae655d5e2dfd3416a45c33a` |
| `miniprogram/utils/reference-font-data.js` | 190570 | `7a33f0b38e9b273ad07ed34cd3648cf8702a299c6ce6471224d04c920784cd63` |
| `miniprogram/pages/about/about.wxss` | 9629 | `5f47852e4fe9046b035a29d977528e910ed78858ad0ba829e71c06b0f90235cc` |
| `miniprogram/subpackages/profile/release-notes/release-notes.wxss` | 10357 | `3e49800ed01f8e1e8d087a50d045943cb37e18dcf70dabd14088c8d6b6878767` |
| `miniprogram/subpackages/profile/guidelines/guidelines.wxss` | 8907 | `588fbf20efbf5d9d39cb0e9cef585c4c13223a0b3a8bbba601339956b4c06254` |
| `miniprogram/subpackages/profile/open-source/open-source.wxss` | 6965 | `e805501ed7201b60380ef136850465792ff46285149e9582076f5bbca1e945cc` |
| `docs/design-sources/reference-fonts/caveat-700-home.woff` | 18280 | `736ba5632b23a1aa7381201b8328be3ea3e286b8ede8545667f7fd6e2fbab19e` |
| `docs/design-sources/reference-fonts/caveat-METADATA.pb` | 1029 | `038342ea08d3f09e11b7f08cfd1e1d556b4f56a48269b0909395aa6fecd4c4f7` |
| `docs/design-sources/reference-fonts/caveat-css2.css` | 272 | `eda299e66ac89888a7bb47169d591db26bbc56ad0d19ce776b2f57c2d44a5acc` |
| `docs/design-sources/reference-fonts/plus-jakarta-sans-400.woff` | 28828 | `3ec7f5cad1bd738387a7c9b7e18428cfb165e9b98bdd26645b9f58fceee492c0` |
| `docs/design-sources/reference-fonts/plus-jakarta-sans-600.woff` | 29604 | `918ce7b19d036bcd59d41ab6198bbf35d77cf46227e56b85274e1dd2522ca8be` |
| `docs/design-sources/reference-fonts/plus-jakarta-sans-700.woff` | 29828 | `4f3f2b563317bc9b948f8aef3c24e01cbc11f342015eaf827f45533f8986d896` |
| `docs/design-sources/reference-fonts/plus-jakarta-sans-800.woff` | 29132 | `7036e01f13e5c43a877d1d0db05f4dda5ba8f76641a64f1c137fa58170b48632` |
| `docs/design-sources/reference-fonts/plus-jakarta-sans-css2.css` | 988 | `cc247a76d65a640e62a0a925934a8ec156d9746ba20b8ed3d23ab295cc5c4a3b` |
| `docs/design-sources/reference-fonts/plusjakartasans-METADATA.pb` | 1396 | `e7953d66e52a1e09235d75fc7aef7139c2733c0b5507afcf6e9afbe0fcef1de6` |
| `docs/design-sources/reference-fonts/source.json` | 8122 | `2128773f810dff3a4a4b3fa4c51874d8105f954efa298c7ee364a9ee7dc73d6c` |
| `docs/licenses/caveat-OFL-1.1.txt` | 4385 | `1f9d81d094273d82f3898a1ee8b598a717d050ecbf5ff7bede105b704880157b` |
| `docs/licenses/plus-jakarta-sans-OFL-1.1.txt` | 4402 | `995c7199cab65954f545996326755daee7b63cc6b42b06c13da1f9502ab08a99` |

root另外冻结的H3事实内容及两showModal模块，只读记录如下（不计入字体19路径）：

| 路径 | bytes | SHA-256 |
| --- | ---: | --- |
| `miniprogram/subpackages/profile/open-source/open-source.wxml` | 7430 | `fe047ca25cfaf5101502ac42ac345928326a5aa67975ba51f1a269c75d41f69b` |
| `miniprogram/pages/index/index.js` | 32598 | `d85b9db816163c4853bd2a7a9abec66dc62e8047d9e79c19457f4cb57dc8ac11` |
| `miniprogram/pages/discover/discover.js` | 17758 | `928b72be56fca9c7cd4d2a8fd8f76d14632ef9c315dbfb2ea62c97a9c81712b5` |
