# PG08 字体字重边界只读审计 — Wave 69 准备

日期：2026-10-02。负责人 `/root/ui65_font_audit`。只新增本独占文档；请求响应、生成 CSS 与观察记录仅保存在 `/private/tmp/caper-wave69-font-audit/`。未改产品、共享字体资源 / loader、配置、验收矩阵或 Git 状态；未安装依赖、运行产品测试、SDK / CLI，未重复 Wave 67 / 68 字体检查。

## 结论与建议

**原稿两个可见英文装饰节点最终 CSS weight 是 900，但原请求没有提供真实 Jakarta 900 字体。无需新增或构造 900 资源。**

恢复 PG08 时保留这两个节点的 source `font-weight:900`；复用现有 `Plus Jakarta Sans` 800 face，正常加载时按 CSS font matching 选最接近的可用 800。不能将 800 的 WOFF / registration descriptor 改称 900、人工加粗原字形，或为追求名义 900 下载来源不明文件。实际微信端匹配与字形仍由 root 做本页限定观察；不能据此次源码审计宣称 native 字形已通过。

原 PNG 只是像素结果，没有字体加载记录；它不能证明历史渲染用了 800、合成加粗还是字体加载失败后的 fallback。当前源 CSS 默许 weight synthesis，**允许不等于确实发生**；没有历史 font trace，不把 900 文字外观或宽度当作合成证据。

## 1. 原稿身份与可见节点

原 ZIP 用户提供 `stitch_design_system_generator (2).zip`，保留全部 39 HTML 引用；本次读取原 `pg08/code.html` / `screen.png`，没有替换或修改原稿。

| 来源 | 字节 | SHA-256 |
| --- | ---: | --- |
| `/private/tmp/irl-stitch-original/stitch_design_system_generator/pg08/code.html` | 20,823 | `c54ae75aef6fccc653601e3d9c23d172e22e7de36b5e4022f72880ba1f39de46` |
| 同目录 `screen.png` | 652,051 | `a18734111819e713f5f2e28edd9b6c0e8b0995c9e73993b533c46cfa7c02ed53` |

已查看完整 PNG。文件只有 IHDR / IDAT / IEND chunk，没有历史浏览器、字体 face / weight / synthesis trace。

完整 HTML 有两处 `font-black`：

| 源位置 | 实际节点 | 同节点级联输入 | 当前生成 CSS / computed weight |
| --- | --- | --- | --- |
| `pg08/code.html:34` | `GOOD PEOPLE` 的 span | `font-label-sm text-label-sm ... font-black` | **900**，11px / 14px，family `Plus Jakarta Sans` |
| `pg08/code.html:37` | 包含 `BRIGHTER DAYS` / ☀️ 的 div | `font-black text-label-sm font-label-sm` | **900**，11px / 14px；内部英文 span 继承 900，☀️ span 继承 900 / 单独 14px |

source config 的 `fontFamily.label-sm` 是 Jakarta family，`fontSize.label-sm` 是 `[11px, {lineHeight:14px, letterSpacing:.02em, fontWeight:700}]`。不能仅按 HTML class 的书写先后推断最终权重。

## 2. 实际源 CSS 级联

原 script 是不固定版本的 `https://cdn.tailwindcss.com`。本次官方请求 HTTP 200，最终 URL **https://cdn.tailwindcss.com/3.4.17**；407,279 B / SHA `176e894661aa9cdc9a5cba6c720044cbbf7b8bd80d1c9a142a7c24b1b6c50d15`，响应保存在临时目录。

仅使用已经安装的 Chrome / `playwright-core`，对完整原 HTML 做一次源 stylesheet 观察：在隔离的 headless context 中以已捕获的相同官方 JS / font CSS 响应满足原 link / script，读取生成的 CSS 规则与 computed style。所有字体二进制、图片和无关请求都阻断；没有下载任何新的 WOFF、测试小程序或点击业务。

当前 Chrome 154.0.8037.93；生成 style index1 的实际顺序：

| CSS rule index | selector | 声明 |
| ---: | --- | --- |
| 147 | `.font-label-sm` | `font-family:"Plus Jakarta Sans"` |
| 157 | `.text-label-sm` | `font-size:11px; line-height:14px; letter-spacing:.02em; font-weight:700` |
| 158 | `.font-black` | `font-weight:900` |
| 161 | `.font-medium` | `font-weight:500` |

同 specificity 下，后生成的 `.font-black` 900 覆盖 `.text-label-sm` 700；两个节点 computed 均为 900。该结果是实际生成规则 / computed style 观察，不是从 class 顺序或名称猜测。生成 CSS 17,132 B / SHA `de68b083ab5c3b87f33d68c71339657fe321eedfb3faf19417f8b178f7154fda`。

观察没有下载或成功加载字体，因此 computed `fontWeight=900` **只证明 CSS 请求值，不证明已使用真实 900 或任何具体字形**。原 CDN URL未固定版本，也没有 PNG生成时的runtime trace；本次冻结3.4.17可复现当前来源级联，不宣称已复原历史渲染环境。

保留观察器的起始路由错误：浏览器把 CDN 根 URL 规范化为带 `/` 的形式，最初准确路由键缺该斜线，源 script 被阻断而等待超时。仅修临时观察器的 root slash lookup 和等待参数位置后取得上述结果；没有为修观察器改产品，也没有从该失败尝试推导任何字体结论。起始错误保存于 `initial-cascade-observation-route-error.json`。

## 3. 原官方字体请求与返回

| source / 官方诊断请求 | HTTP / 结果 | 本次保存响应 |
| --- | --- | --- |
| 原 HTML:1 `[Jakarta 400;600;700;800 + Material](https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200)` | **200**；返回 Jakarta normal 的 400 / 600 / 700 / 800 各4个 unicode-range 声明，无900 | `source-first-family.css`，7,052 B，SHA `874542290025679071fcbfd3fe73cd0266e18e0bcfa276b08cff13a6bff83784` |
| 原 HTML:3 `[Jakarta wght@100..900](https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@100..900&display=swap)` | **400**；所请求 family / axis range 不可用，返回 HTML error，**没有 font-face / font binary** | `source-jakarta-100-900-response.html`，6,510 B，SHA `091b75bcb1c07a3e4ef83dc994647da1e92a70d46e8ae069306050c9fb032870` |
| 独立确认 `[Jakarta wght@900](https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@900&display=swap)` | **400**；单独900不可用，返回 HTML error，**没有 font-face / font binary** | `official-jakarta-900-response.html`，6,502 B，SHA `7ad5f7101842a56afe28ee188a3ab6a12b9093dbd8f0d09c80832edf3cb2c7fe` |

请求 UA 和完整 response headers / status / URL / byte hash均记录于 `response-manifest.json`；没有伪造成功响应或把 HTML error 当字体读取。现代 UA的有效 first CSS对每个 unicode subset 使用相同 Gstatic URL，分别声明请求的四个 weight；本次没有读取这些字体二进制，因此不从这种相同 URL 推断文件内部 fvar axes。

Google Fonts 官方 [Plus Jakarta Sans METADATA.pb](https://raw.githubusercontent.com/google/fonts/main/ofl/plusjakartasans/METADATA.pb) 当前明确声明 **wght 200..800**；source repository 为 Tokotype / commit `18d1cd2f7ea10481919d2f05c1f7064b7307fc26`，normal / italic 为 `[wght].ttf`，许可 OFL。捕获 metadata 1,396 B / SHA `e7953d66e52a1e09235d75fc7aef7139c2733c0b5507afcf6e9afbe0fcef1de6`。这是官方 catalog axes 元数据；没有对未取得的900文件虚构轴或字重。

原100..900 link失败并不意味着整页 Jakarta 一定失败：原first link仍有四个有效faces。此处用当前官方响应解释来源边界，不把当前HTTP结果等同于PNG历史请求日志。

## 4. 800 匹配、合成与已有资源

按 [CSS Fonts Level 4 字体匹配规则](https://www.w3.org/TR/css-fonts-4/#font-style-matching)，请求 weight大于500且没有准确face时先找更高可用weight，再按降序找较低weight。因此，**在原400 /600 /700 /800正常加载且同family覆盖目标Latin glyph的条件下，900请求匹配800**。这是规则与有效face声明结合的推论，不是此次未加载字体的渲染结果。

原 computed `font-synthesis` 为 `weight style small-caps`。[font-synthesis-weight](https://www.w3.org/TR/css-fonts-4/#font-synthesis-weight) 允许引擎在缺少bold face时合成，并不要求或证明对已有800继续合成900；不能把普通weight matching等同于合成。原 PNG / 此次CSS-only观察均无实际face或合成trace，历史是否加粗保持**未验收**。

已有[官方静态资源证明](../design-sources/reference-fonts/source.json)给出 `plus-jakarta-sans-800.woff`：29,132 B，SHA `7036e01f13e5c43a877d1d0db05f4dda5ba8f76641a64f1c137fa58170b48632`，OS/2 weightClass800，静态无axes，version2.071。资源已在 `docs/design-sources/reference-fonts/plus-jakarta-sans-800.woff` 与现有Data URL module中，不下载第二份、不修改descriptor或byte。400 /600 /700也复用原faces；新增500保持原 **Caper Jakarta Profile 500** alias，仅profile source500 consumer使用，不把PG08也改为新500family。

因此本任务建议 **新增字体binary / app包bytes =0**；这是建议的资源增量，不是编译包测量。保留source900 CSS +既有800匹配是可审查方案；若微信呈现出现具体字形差异，root按实际PG08证据定位，不能先设计另一字体或自行轮廓加粗。

## 5. 临时证据与边界

以下仅存 `/private/tmp/caper-wave69-font-audit/`，没有复制进app或更改shared data / loader：

| 文件 | 字节 | SHA-256 |
| --- | ---: | --- |
| `response-manifest.json` | 7,466 | `12ad3525e1ecdbbe3c09eeeab397e3b9447ab56e38bd9ae8b13f4321a91324b8` |
| `source-cascade-observation.json` | 8,212 | `fc29b023138c549dad2a1688603e55c67ab89e95f1f8accd82b5b4d082958e02` |
| `generated-style-1.css` | 17,132 | `de68b083ab5c3b87f33d68c71339657fe321eedfb3faf19417f8b178f7154fda` |
| `weight-boundary-proof.json` | 18,821 | `0c5ab8d7320316261841c0edf2491e64c505a13179d0d49c9b15089f94164db7` |
| `inspect-source-cascade.js` | 4,830 | `3d39d1c14773823ae67021ccac2a1998eb3caa039334dc5d58426cdf690fdce0` |
| `initial-cascade-observation-route-error.json` | 437 | `a15ada7af7e32b4dd5b1bd94cfa2b028f867d7ddbb0205c1201728b660994f1d` |

两个400完整错误body、官方METADATA、当前sourcefirst CSS、当前Tailwind JS均按上述SHA保留，未执行Google错误页中的script。没有900binary、没有字体subsetting /合成 /重新许可处理。实际微信字形、各viewport、业务与编译包预算不属于本只读来源结果。
