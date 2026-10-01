# Wave67：实际预览压缩与低风险包体候选只读审计

日期：2026-10-02。范围：只读取现配置、根代理现有 preview 产物、已安装微信开发者工具的 CLI / 编译源代码及现有主包 JPEG 结构。没有运行 CLI / SDK / 全量测试、修改产品 / 配置 / 图形、重新编码图片或下载资产。后续 create FORM / REVIEW 由另一实施记录覆盖。

## 当前实测边界

根代理提供 `/private/tmp/caper-wave66-publish-preview-info.json`：main **2,094,089 B**、activity **78,943 B**、profile **929,315 B**、total **3,102,347 B**。main 距 2 MiB（2,097,152 B）剩 **3,063 B**。六份证据 JSON 迁出前后 preview 完全一致，编译收益 **0 B**；详见 [迁移证据](caper-main-evidence-relocation-wave66-2026-10-02.md)。

仅在源码中找到优化代码或统计原文件体积，都不能作为本次编译贡献的定量证明。没有执行设置开关的对照 preview 或读取最终包内每个编译条目，故 JS / WXSS / WXML 各自的实际压缩节省尚未拆分。

## 已启用的压缩与 CLI 参数

| 项 | 现配置 / 本地源码行为 | 对下一批的意义 |
| --- | --- | --- |
| JS | `project.config.json.setting.minified = true`；`compilejs.js` 把 `setting.minified` 作为 minify 条件，按转换路径调用 UglifyJS / Terser；summer script 分支按 `resultType != dev && minified` 压缩 | 已开启。不能重复建议打开，也不能把单纯删除源码空白算额外编译收益 |
| WXSS | `minifyWXSS = true`；`compilewxss.js` 用 cssnano 的 default preset，保留配置中禁用的 transform / calc / selector / URL 变换；新版 wxss 分支只对非 dev 结果优化 | 已开启。代码去重仍可能改变编译内容；单纯格式压缩已经由编译器处理 |
| WXML | `minifyWXML = true`；原编译 handler 和 summer minifywxml 分支按该开关处理 | 已开启。不可重复开启当作新增空间 |
| CLI preview | 安装包 `js/common/cli/index.js` 的 v2 `command: preview` builder 只有 `qr-format`、`qr-output`、`qr-size`、`info-output`、`compile-condition`；未声明 minify / uglify / compile-settings 开关 | 不添加猜测参数。压缩受项目设置和预览编译路径控制 |
| Source maps | `uploadWithSourceMap = true`；安装包预览组件将 `noMaps` 设为 `uploadWithSourceMap === false`，原编译器可产生 `.js.map` | 可由根代理评估一次真实配置对照，但尚未证明 maps 计入 main size，因此不能预估收益 |

现 `project.private.config.json.setting.ignoreDevUnusedFiles = true`、`bigPackageSizeSupport = false`，`packOptions.ignore` / `include` 为空。不能重复建议已启用项，也不能扩大 2 MiB 门槛。六证据 JSON 的零编译收益与上传默认忽略未用文件的行为相容；本审计不以此单一观察断定唯一原因。

本机 app.asar 的 `package.json` version 为 `2.02.2609231`。只将安装包实现作为本次本地主张的 primary source：未执行其中代码。官方 CLI / 项目配置网页于本次访问返回 non-retryable open error，未引用未取得的网页正文。

## JPEG 无损元数据空间

- 主包 16 份 JPEG 总计 **1,095,146 B**；按 SOI / length-bearing marker / SOS entropy 区域及 EOI 原字节解析，没有解码或写入产品。
- 每张只含一个 **18 B APP0 JFIF**，缩略图尺寸 0 × 0；没有 EXIF、COM comment、XMP、ICC 或其他 APPn 可移除项。JFIF 对颜色解释 / 密度可能有意义，保持全部原字节。
- **可以证明的非渲染元数据净节省为 0 B**。不会以删除 JFIF、降低 quality 或改分辨率制造空间。
- 全部为 SOF0、单 SOS；DHT 为随图变化的短表，不能假设使用未优化的默认 Huffman table。未执行 entropy 优化，真实无损编码收益未知。
- PATH、`/opt/homebrew/bin`、`/opt/homebrew/opt/jpeg-turbo/bin`、`/usr/local/bin` 和 `/usr/local/opt/jpeg-turbo/bin` 未发现 `jpegtran`；不安装、不下载、不以有损 decode / re-encode 代替 lossless coefficient 重排。

机器记录：`/private/tmp/caper-wave67-preview-budget/jpeg-metadata-audit.json`，SHA-256 `c926383783668615c8a10743c257b4e1064a95aee542c419de5651a5a094d3aa`。

## 可交给根代理的后续方案

| 方案 | 已证明影响 | 待证明 / 风险 |
| --- | --- | --- |
| 共享 3 组同字节主包 SVG | 只用 city 的原 byte 文件，删除 about / create 五个副本，素材减 1,857 B、五 src 字符变化加 40 B，原始净减 **1,817 B**；SVG child / glyph 原字节不变 | 需根代理授权路径变更并做受影响页检查、一次真实 preview；尚未执行，编译收益未知。详见冻结 [主包预算审计](caper-main-package-budget-audit-wave66-2026-10-02.md) |
| Source map 设置对照 | 现配置 true；本地预览组件有 `noMaps` 选项关系，保持 WXML / WXSS / JS 业务原文 | 主包实际是否计 maps 未证明；关闭会改变预览调试能力。根代理独占配置，可先用一次必要对照证明包体变化，再决定是否采用；不承诺具体字节 |
| AST 证明重复 CSS 或 JS 字符串共享 | 编译器压缩不会自动证明所有历史样式可删；需要找到实际重复运行内容、保留 cascade / 初始化语义 | 本次未发现可直接删除的大块内容，不凭命名或旧样式前缀判定死代码。需限定所有状态和 source binding 后再立项；不计已获空间 |
| event 页迁入分包 | 主 event JS / WXSS / WXML 是主包大项，路由架构改变可能提供更多空间 | 会影响已有邀请、二维码、聊天、活动深链及返回栈，属于较大架构工作，不能作为无风险小修；本次未授权 / 未执行 / 未计节省 |

推荐先完成根代理已授权的 Wave67 最小原稿恢复并实际 preview；若超预算，优先采用可以精确保留图形 bytes 的 SVG 共享，或先验证 source map 的实际贡献。不要重复配置现有 minify 开关、删字体许可、降低图像质量或把未经验证的源码字节当成编译空间。

## 冻结的本地实现证据

只读抽取到 `/private/tmp/caper-wave67-preview-budget/asar/`，来源 `/Applications/wechatwebdevtools.app/Contents/Resources/app.asar`。原应用包没有改写。以下 hash 是读取的原始源文件字节：

| app.asar 内位置 | B | SHA-256 |
| --- | ---: | --- |
| `js/common/cli/index.js` | 1078818 | `3751162de8167f75359818779a991a765a7c6bd4e41029f549789d177205f962` |
| `js/common/miniprogram-builder/modules/corecompiler/original/workerThread/task/compilejs.js` | 3963 | `b8b63a8bf2ef1e9120dc142ba139d4a6b599e12df65ad0792bf2bae57c5d4efb` |
| `js/common/miniprogram-builder/modules/corecompiler/original/workerThread/task/compilewxss.js` | 1511 | `1dd1fcdd5ea62a44d533c84c6fd49df160cb4dfbbfcda0c4adc9e77323eeec86` |
| `js/common/miniprogram-builder/modules/corecompiler/original/compile/handler/wxml.js` | 1423 | `7b7da88fa1db0942bfc7b623e87f1d534e24916a3339297fee28d5709d87da1e` |
| `js/common/miniprogram-builder/modules/corecompiler/summer/plugins/filetask/script.js` | 3141 | `32be209bb919619f4a0e0cc4535eec278e5ae8231da1161b952d10c97f6b7a2c` |
| `js/common/miniprogram-builder/build-server/tasks/baseFileCompiler/wxss.js` | 2877 | `6b319a10d976df30cc83b670249db436ce694f4d6b02e27a363a5f9721e6c25a` |
| `js/common/miniprogram-builder/modules/corecompiler/summer/plugins/minifywxml.js` | 1305 | `ad2d8ae5409a92f53af78e902071da4fe4ef476fa35569b2f916c0b8033effcc` |
| `js/cabdc6fe629051f757daa29990f17fcb.js` | 12755 | `7ddfb9719b51de304f0d760e3f53c6b591ac8d22ddba56d693ef6724810cd9e0` |

正式产品配置仍由根代理独占。本审计不替代新 UI 的编译 / 点击，也不宣称代码级或项目整体完成。
