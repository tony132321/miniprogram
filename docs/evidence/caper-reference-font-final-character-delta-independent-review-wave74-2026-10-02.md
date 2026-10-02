# Wave74 最后手写字符增量独立审核

- 日期：2026-10-02。
- 结论：本次 W / y 增量未发现来源或保护差异。
- 范围：只读比较 Wave73 最后冻结的两份 Caveat WOFF 与当前 WOFF / Base64 载荷；不修改应用、字体、首页、矩阵或 Git，不重跑此前来源检查、VM 测试、CLI、SDK。
- 对应完整逐字证据：`caper-reference-font-final-character-delta-independent-review-wave74-2026-10-02.json`。

## 实际载荷与净字节

当前 `miniprogram/subpackages/profile/fonts/reference-font-data.js` 为 **262,502 B**，SHA-256：

`fb39653c8663ba1bb7aa79e90df267aca6d1c6dd606ea484d8a052dbd53ad3de`

前一冻结副本 `/private/tmp/caper-wave73-shared-independent/font-data-captured.js` 为 260,198 B / `1702d6644db3e5998132bacfe7d7067e37367148d6b8668327b5f066e7379b32`。本次模块原始净增 **2,304 B**；两份 WOFF 原始净增 **1,728 B**。相对于 232,987 B 历史模块的累计净增为 29,515 B，不能将其当作本次增量。

| 字体 | 旧 WOFF | 新 WOFF | WOFF 净增 | Base64 净增 | 唯一新增字符 |
| --- | ---: | ---: | ---: | ---: | --- |
| Caveat 700 | 28,076 B | 29,172 B | 1,096 B | 1,460 B | U+0057 `W` |
| Caveat 600 | 11,624 B | 12,256 B | 632 B | 844 B | U+0079 `y` |

审过的完整模块副本保存在 `/private/tmp/caper-wave74-final-font-delta-independent/font-data-reviewed.js`，其字节与上述当前载荷相同。

## 旧字符与度量保护

700 的旧 39 个 Unicode 全部保留，当前 40 个；600 的旧 17 个全部保留，当前 18 个。所有 **56 个旧字符槽位**逐一比较 `DecomposingRecordingPen` 命令序列、hmtx advanceWidth 与 leftSideBearing，结果完全相同。没有移除或额外新增的 Unicode。

两份字体的全局度量也完全相同：head unitsPerEm 与全局 bbox；hhea ascent/descent/lineGap、advanceWidthMax、最小左右 bearing、xMaxExtent 和 caret 字段；OS/2 字重、宽度类、Typo/Win 行度量、x/cap 高度与上/下标、删除线字段；post italicAngle、下划线与 fixedPitch。JSON 留存具体字段值和每个旧字符的轮廓 SHA / advance / LSB，未用字符名称相同代替轮廓比较。实际 OS/2 usWeightClass 分别为 700 / 600。

来源固定文案 `Wukang Road`（700）与 `Play More`（600）所需的全部字符现在存在；新增 W / y 均有非空原字体轮廓。中文及 ☺ / ♡ / ⚡ 的既有 fallback 边界不属于本次字符补齐。

## 官方来源与运行载荷

本次没有重复网络请求。只读核对已留存的 Google Fonts CSS 响应、所指 WOFF 原字节和 source.json 中的 URL / UA / hash；运行模块两段 Base64 解码后分别与对应 WOFF 完全相同。

| 当前保存的来源 WOFF | SHA-256 |
| --- | --- |
| `docs/design-sources/home-long-reference-fonts/caveat-700-complete-fixed-ui.woff` | `2ae8d170291eac2235cb55d6a5b06983c130ecf40ee8c6e792b48d433f2ce3a8` |
| `docs/design-sources/home-long-reference-fonts/caveat-600-city-visitor-union.woff` | `ca1da3b722f5e58054147d2e98974c6cbda73cfa33ac7e76ebaa133dedc785d1` |

700 CSS SHA 为 `3f05d70aeef03e49d04285bd2dbc4773a90bf6d75e5a1f1d841038c71edeedec`；600 CSS SHA 为 `8440513d7f8f44f40a111b00073fa70c32e2df6f0206e1d42c475cd19bcd0abe`。两份已读 CSS 均为 Caveat / normal / 正确 700 或 600 / WOFF；JSON 保留准确 Google CSS 请求和 gstatic 响应 URL。

## 其余字体、许可与完整逆除

另六份字体的**整个记录**与前一冻结模块一致：Plus Jakarta Sans 400 / 600 / 700 / 800、Rubik Mono One 400、Caper Jakarta Profile 500。两份 Caveat 除 data 之外的记录字段也一致。

从 `const OFL_COMMON_BODY` 起的许可 suffix 整字节一致。仅将两段新的 Base64 原位替换回前一冻结 Base64 后，**整个模块**精确恢复 260,198 B / `1702d6644db3e5998132bacfe7d7067e37367148d6b8668327b5f066e7379b32`。因此记录、排序、格式、其余六份载荷与许可导出没有伴随变化。

上一份 Wave73 共享独审报告保持其历史阶段，未改写：MD SHA `1c17aaf36ab00505f314b68ac1c5fbde74cea544c96e864e34ae53d3bd48832b`；JSON SHA `35944ec4fdb96d71bef9e6e40f6fb6043d7c5b98ea7f9ee685f1cec5cfd115e8`。

## 证据边界

本报告是最终两字符的来源 / 载荷 / 保护审核。没有执行原生字体 callback 或截图验证，不声明逐像素视觉通过。此前 source 或 VM 测试未重复运行。独立比较脚本与逐字 proof 保存在 `/private/tmp/caper-wave74-final-font-delta-independent/`。
