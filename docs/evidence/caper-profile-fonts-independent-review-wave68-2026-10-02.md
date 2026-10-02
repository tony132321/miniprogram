# Wave 68 新增个人页字体与返回 glyph 独立来源审查

日期：2026-10-02。只读审查者：`/root/ui64_review`。对象：root 的共享 Jakarta normal 500 与 Material 返回 600 来源；**不作为本人 C / D 页面的独立审查**。基线 `a72ba3e`。结论：本范围未发现来源、字重、payload、许可、旧模块保护或 SVG 实例阻断；原生字体加载与像素结果待 root 的限定运行验证。

## 阅读与一次独立检查

完整阅读 root 实施报告 `docs/evidence/caper-profile-shared-fonts-wave68-2026-10-02.md`、`source.json`、数组格式 `inspection.json`、`module-proof.json`、`module-export-check.json`、**最终** `final-inverse-proof.json`、两份完整官方缓存 CSS、现有 loader，并直接读取新字体二进制与原 4 页 header 的实际 class / link 顺序。没有执行 root 的 export 脚本或重复 Wave 67 的旧 Caveat outlines 证明。

独立检查脚本 `/private/tmp/caper-wave68-shared-font-independent/review.py` 执行一次，exit 0。完整实际输出 `/private/tmp/caper-wave68-shared-font-independent/independent-source-inspection.json`，SHA256 `0601c9fbfa94615a71d79d3b466ed6f4ecc8a05e2316335d57f651f9463d2638`。只在独占 tmp 保存基线和检查结果；没有产品/Git/矩阵变更，也没有新测试、CLI、SDK 或全量运行。

工具复用既有 FontTools **4.60.2**，Python `/Users/tsb/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3`，`sys.path` `/private/tmp/irl-material-symbols-wave60/fonttools`；WOFF2 读取通过既有 Node `/Users/tsb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node` 的 `zlib.brotliDecompressSync` bridge。没有安装依赖、重编码字体或舍入坐标。

## 首次冻结模块：来源 comment 也纳入逆还原

首次检查冻结的 `miniprogram/utils/reference-font-data.js` **232,979 B**，SHA256 `41284603a66d75bef587fc40a68df86cd1b0daf119d7694c653531abae57294e`。Git 基线实际读取为 **193,256 B**，SHA256 `486de055ed7ecb35f165fcac8546c9cd916fc21a563b09803f59693c3c7ec7c8`。只存在 2 个实际 diff 区块：

1. 第 2 行 provenance comment 130 → 154 B，加入 `profile-reference-fonts`。
2. 原第 33 行到最终第 33–34 行，4 → 39,703 B，追加 500 face 并加原尾逗号。

将上述两区块逆还原后与基线完整模块逐字节相等；与最终 `final-inverse-proof.json` 对应。`module-proof.json` 记录了补 comment 前的阶段，不以它的旧 `inverseEqual` 冒充最终两处改动证明。

7 个 `family|weight` 唯一组合中，原 6 个对象的 family / weight / data 序列逐项全等，新 500 是第 7 项；旧 payload 没有被重新 subset 或重编码。

| 旧 face family | Weight | 解码 Bytes | 解码 SHA256 |
|---|---:|---:|---|
| `Caveat` | 700 | 19,336 | `e587efbee29f5e2239cf3b1e9fc63eaf71e200607b9b84c70226913bddc6cb03` |
| `Plus Jakarta Sans` | 400 | 28,828 | `3ec7f5cad1bd738387a7c9b7e18428cfb165e9b98bdd26645b9f58fceee492c0` |
| `Plus Jakarta Sans` | 600 | 29,604 | `918ce7b19d036bcd59d41ab6198bbf35d77cf46227e56b85274e1dd2522ca8be` |
| `Plus Jakarta Sans` | 700 | 29,828 | `4f3f2b563317bc9b948f8aef3c24e01cbc11f342015eaf827f45533f8986d896` |
| `Plus Jakarta Sans` | 800 | 29,132 | `7036e01f13e5c43a877d1d0db05f4dda5ba8f76641a64f1c137fa58170b48632` |
| `Rubik Mono One` | 400 | 4,040 | `36faf220f9935cff89be4b5611a337202dc2a95be07df3565594ce6208c4285a` |

原 3 个完整许可导出字符串与基线逐字节相等，保留原版权、换行和全部正文；没有增加新字体家族许可：

| 许可 family | UTF-8 Bytes | SHA256 |
|---|---:|---|
| `Caveat` | 4,385 | `1f9d81d094273d82f3898a1ee8b598a717d050ecbf5ff7bede105b704880157b` |
| `Plus Jakarta Sans` | 4,402 | `995c7199cab65954f545996326755daee7b63cc6b42b06c13da1f9502ab08a99` |
| `Rubik Mono One` | 4,462 | `43d530580461a574f6dfed9e15af6a74e95f7c04d9bfa1174a63ff036e8eee07` |

`miniprogram/utils/reference-fonts.js` 与 `miniprogram/app.js` 均直接与 `a72ba3e` 比较字节全等。现 loader 对资源读取 `family`、normal style 与 `weight`，每项通过 wx success/fail callback 记录状态；新增一项不需要改变 loader 契约。本次并未执行该 loader，不能宣称新字体已原生 loaded。

## Jakarta normal 500

官方完整缓存 CSS 明确 family `Plus Jakarta Sans`、style `normal`、weight `500`，WOFF 请求/响应记录见 source.json。当前第 7 项 family / weight 对应准确，Base64 39,640 B 解码为该官方 WOFF **29,728 B**，SHA256 `1ed396140566c054e9330fbddc30fbc479f674fd3bc2ecc237b2255ba7d2c7f4`，字节全等。

独立 FontTools 实际读取：unitsPerEm 1000、OS/2 weightClass **500**、无 fvar、非 italic、best cmap **721 Unicode**；name family `Plus Jakarta Sans Medium` / subfamily `Regular`，version `2.071;gftools[0.9.30]`。这是 Medium 的实际字体字重，wx 指定显示 family 使用原 CSS family；没有把旧 400 face 重新命名成 500。

原 `pg10_a_edit_profile/code.html:77` 的 bio-counter 明确 `font-medium`；`pg10_c/code.html:73 / 150 / 218` 的场地节点同样为 `font-medium`。本次新 500 面有真实源依据。中文与表情仍使用系统回退，721 Unicode 不代表完整中文覆盖；不声称英文/中文回退与 source PNG 的系统环境逐像素相同。

## Material 返回：实际 variable 实例

4 页原 header 均为 `material-symbols-outlined text-[24px] font-semibold` 的 `arrow_back_ios_new`，parent 为 `text-on-surface`，source token `#1a1b1f`。四页 link 顺序均先多轴 Material，再同 family/style 的 wght/FILL Material；后置请求使用 wght100..700/FILL0..1，24pt family 固定 opsz24/GRAD0。仅返回节点明确 font-semibold600，不能据此把所有 400 图标都改成 600。PG04-S 的 close22/normal400 不使用本实例。

独立读取官方 WOFF2：family `Material Symbols Outlined 24pt` / subfamily `Regular` / version **2.972**，unitsPerEm **960**；fvar 实际只有：

| Axis | Min | Default | Max |
|---|---:|---:|---:|
| FILL | 0 | 0 | 1 |
| wght | 100 | 400 | 700 |

FontTools 实例化 **wght600 / FILL0** 后从 U+E2EA（`uniE2EA`）通过 SVGPathPen + TransformPen Y 翻转得到：

```text
M641.1304931640625 -61.912109375 222.47735595703125 -480.0 641.1304931640625 -898.087890625 730.2183837890625 -809.0 401.2183837890625 -480.0 730.2183837890625 -151.0Z
```

与 root 冻结 SVG `<path d>` 完全相等，未经坐标舍入或图形简化。其 viewBox 为 `0 -960 960 960`，root fill 为准确 `#1a1b1f`，266 B，SHA256 `efeb362fc20c3e3a66fb6dc7be585f6ea7db8e9983609c44e148ef76807c3b24`。这次来源证明实际生成 600 outline，没有沿用旧 400 静态 SVG 来声称 600。

## 官方缓存字节与边界

直接读取下列原服务缓存文件并比较 source.json 中记录的 hash 与长度，全部相符；这里只证明当前缓存和下载记录一致，并未重新联网下载。

| 缓存文件 | Bytes | SHA256 |
|---|---:|---|
| `docs/design-sources/profile-reference-fonts/plusjakarta-500.css` | 247 | `30e792ecef6f02953db177b070f88e16e6d618758db26b37a67e43de936d7673` |
| `docs/design-sources/profile-reference-fonts/plusjakarta-500-0.woff` | 29,728 | `1ed396140566c054e9330fbddc30fbc479f674fd3bc2ecc237b2255ba7d2c7f4` |
| `docs/design-sources/profile-reference-fonts/material-profile-back-variable.css` | 709 | `ad1e70a4cddb1d48340fc465e84288d3af76e1a45b31bb9a7effda585a77eccc` |
| `docs/design-sources/profile-reference-fonts/material-profile-back-variable-0.woff2` | 1,644 | `ac70d99ac50b14eb11c967b0a69dc509681d2817cd9df7128f848bbabc03759f` |

原官方来源 URL、UA、响应类型/CORS、许可位置保留于 `docs/design-sources/profile-reference-fonts/source.json`，docs 原 CSS/WOFF/WOFF2 没有复制为产品资产库。模块净增 **39,723 原始 B**；实际编译包体与 font callback 由 root 的本批 CLI / 定向 SDK 实测。页面 glyph 复制和完整页面绑定保护另由页面 owner 的 freeze 与独立 reviewer 覆盖。

本结论仅针对新增共享字体与 600 返回的来源/实例/保护范围，不表示全 39 页像素验收、真机、线上或其他未检查图标/字体全部通过。

## 最终定点订正：专用 500 family alias

后续消息来源审计发现 N1 仅请求 Jakarta 400/600/700/800，原 CSS 500 匹配旧 400。为保持非个人页的面匹配，root 仅将第 7 个新增 face 的 family 从 `Plus Jakarta Sans` 改成 **`Caper Jakarta Profile 500`**。最终模块 **232,987 B**，SHA256 `8cd1ac18d092175c22daaa5c80749251707f6b16f82d1550263b5aef875bda41`，对基线净增 **39,731 B**。上文 232,979 B / `41284603…` 和一次完整检查结果保留为修正前历史证据，不冒充对新 family 重跑的全量证明。

必要定点核验：第 7 项 family 为专用 alias，weight 为 500，Base64 仍解码为官方 29,728 B，SHA256 `1ed396140566c054e9330fbddc30fbc479f674fd3bc2ecc237b2255ba7d2c7f4`。将最终模块唯一紧凑 JSON alias 字面值逆回旧 family，整个模块严格恢复首次冻结 232,979 B / `41284603…`，因此旧 6 faces、3 完整许可、provenance comment、payload 和其它模块字节均未再改变。Root 更新的 `final-inverse-proof.json` 仍纳入来源 comment 与 alias face 两区块，append 区块为 39,711 B；`alias-scope-correction.json` 保存前后映射。未重复完整审查脚本或 FontTools 导出。

C 消费者仅为原 pg10_c:73/150/218 三个场地 span 的 `.moments-page .moment-venue`。唯一新增专用 family 声明，500 与颜色保持，逆除后恢复此前完整 C CSS。该消费者由本人 C 实施负责，不算本人页面的独立审查；A 消费者由其 owner/root 核。其它仍引用 `Plus Jakarta Sans` 的页面不会因这个专用 alias 多出 500 面。

定点记录 `/private/tmp/caper-wave68-profile-cd/profile-alias-local-correction.json`，SHA256 `3d8d3d7fd31ed2d5953e377cf7220263567fccaa56d6ea36d8f9fe4b75e225fa`。局部首稿的属性空格假设和后续执行前的 heredoc 编码诊断保留于记录，读取真实 compact 字面值后已完成局部核验；没有产品字体修复或重复 CSS 改动。实际 alias 回调、消费者显示和编译预算仍待 root 限定运行，不以 register 匹配宣称字体 loaded。
