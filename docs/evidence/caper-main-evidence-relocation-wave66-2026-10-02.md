# Wave66：六份主包来源证据原字节迁移

日期：2026-10-02。执行范围由根代理确认：只把已经查明无运行引用的六份来源 JSON 从 `miniprogram` 迁到 `docs/design-sources/main-package-relocated/`，为后续按原稿恢复 UI 保留主包空间。

## 结果

- 六份 JSON 的新文件分别与迁移前原文件字节及 SHA-256 相同；原路径均不存在。原始主包净移出 **40,291 B**。
- 来源、版权、许可、路径和 hash 字段保持原文；没有重序列化、删字段、截短许可或改变换行。
- 本任务没有修改运行时 WXML、SVG、图片、字体、业务 JS、配置、验收矩阵或历史证据正文。已识别的五个 SVG 路径去重方案没有执行。
- 根代理迁移后的最终 CLI preview 已提供实测：main **2,094,089 B**、total **3,102,347 B**，与迁移前字体许可去重后的 preview 完全相同。六份 JSON 迁移的 **实际编译节省为 0 B**；40,291 B 只表示应用源码范围移出，不能计为已获得的包体空间。

## 冻结审计与迁移位置

迁移前盘点：[主包预算审计](caper-main-package-budget-audit-wave66-2026-10-02.md)，11,231 B，SHA-256 `7ffd1f91dda6aa93af55fb162ffaafa335848899add1403f413cd9e7d7fc2805`。该审计已先冻结，保留当时旧路径、库存与候选分析。

迁移映射：[relocation-map.json](../design-sources/main-package-relocated/relocation-map.json)；可读索引：[迁移目录 README](../design-sources/main-package-relocated/README.md)。相对 `pages` 结构完整保留。

| 原运行目录位置 | 新证据位置 | B | 原 / 新相同 SHA-256 |
| --- | --- | ---: | --- |
| `miniprogram/pages/discover/assets/phosphor-sources.json` | [pages/discover/assets/phosphor-sources.json](../design-sources/main-package-relocated/pages/discover/assets/phosphor-sources.json) | 8,205 | `f4f229a006e06bd1388752ac0921d07ddb3415251ec64bfebd3fb7d1588382d2` |
| `miniprogram/pages/city/assets/material-symbols-sources.json` | [pages/city/assets/material-symbols-sources.json](../design-sources/main-package-relocated/pages/city/assets/material-symbols-sources.json) | 8,605 | `44814d81d20c1006a38a94b36f2b30f8b61171359c8ca67366e4d41214f703f4` |
| `miniprogram/pages/about/assets/reference-logo-sources.json` | [pages/about/assets/reference-logo-sources.json](../design-sources/main-package-relocated/pages/about/assets/reference-logo-sources.json) | 626 | `e69657e858780910ed22ab7318ad7fc6a62ae7572af1daf6a1a0ea58f76ffdad` |
| `miniprogram/pages/about/assets/material-symbols-sources.json` | [pages/about/assets/material-symbols-sources.json](../design-sources/main-package-relocated/pages/about/assets/material-symbols-sources.json) | 9,352 | `53398a62e0e27af0f2e7396775d538dc88f07d40395ac20f3865d55b20757293` |
| `miniprogram/pages/me/assets/source-manifest.json` | [pages/me/assets/source-manifest.json](../design-sources/main-package-relocated/pages/me/assets/source-manifest.json) | 8,090 | `1fef1e21fc1599a1b4f83119dd05becc06a6c2a7a86e82fdd8e1fdd37c88b4ba` |
| `miniprogram/pages/index/assets/manifest.json` | [pages/index/assets/manifest.json](../design-sources/main-package-relocated/pages/index/assets/manifest.json) | 5,413 | `0d1c73ad8483d1e016e828260ecbbdbaf3999a422d365446fae1d1d8893aca99` |

## 根代理的迁移后 CLI 实测

根代理于 2026-10-02 提供最终产物 `/private/tmp/caper-wave66-publish-preview-info.json`，CLI session `99932` 已结束，exit `0`。本任务只读取该产物，没有启动 CLI。原始产物记录 main `2094089`、activity `78943`、profile `929315`、total `3102347` B；迁移前后值完全相同，因此迁移的编译包体贡献为 **0 B**。

2 MiB 为 2,097,152 B，当前 main 尚余 **3,063 B**。这些数字只是根代理该次 preview 的包体证据，不替代页面点击、真机或整体完成验收。正式原始实测归档：[根代理开发者工具测量记录](caper-wave66-devtools-measurements-2026-10-02.json)，其中 `finalPublishPreview` / `migration` 由根代理维护。本迁移原始字节与 hash 的通过结论保持。

## 历史证据的可追溯关系

历史报告记录的原包内地址属于当时实现快照，正文没有改写；可用上表及机器映射取得现在保存的同字节证据。

- `miniprogram/pages/discover/assets/phosphor-sources.json`：[caper-discover-reference-ui-wave64-2026-10-01.md](caper-discover-reference-ui-wave64-2026-10-01.md)。
- `miniprogram/pages/city/assets/material-symbols-sources.json`：[caper-next-reference-gap-audit-wave65-2026-10-02.md](caper-next-reference-gap-audit-wave65-2026-10-02.md)；[caper-city-reference-ui-wave63-2026-10-01.md](caper-city-reference-ui-wave63-2026-10-01.md)。
- `miniprogram/pages/about/assets/reference-logo-sources.json`：[caper-pg10h-h3-reference-ui-wave62-2026-10-01.md](caper-pg10h-h3-reference-ui-wave62-2026-10-01.md)；[caper-wave62-independent-source-review-2026-10-01.md](caper-wave62-independent-source-review-2026-10-01.md)。
- `miniprogram/pages/about/assets/material-symbols-sources.json`：[caper-next-reference-gap-audit-wave65-2026-10-02.md](caper-next-reference-gap-audit-wave65-2026-10-02.md)；[caper-pg10h-h3-reference-ui-wave62-2026-10-01.md](caper-pg10h-h3-reference-ui-wave62-2026-10-01.md)；[caper-wave62-independent-source-review-2026-10-01.md](caper-wave62-independent-source-review-2026-10-01.md)。
- `miniprogram/pages/me/assets/source-manifest.json`：[caper-me-reference-ui-wave64-2026-10-01.md](caper-me-reference-ui-wave64-2026-10-01.md)。
- `miniprogram/pages/index/assets/manifest.json`：[caper-home-reference-ui-wave64-2026-10-01.md](caper-home-reference-ui-wave64-2026-10-01.md)。

## 本次限定验证

迁移前已通过的引用盘点未重跑。本次仅进行六个移动文件的原 / 新精确字节检查及迁移后的零运行引用检查：

1. 移动前读取完整原字节并与冻结的 bytes / SHA-256 核对。
2. 使用文件移动保留原内容，新路径读取后逐字节相等、bytes / SHA-256 相等，旧路径不存在。
3. 在 `miniprogram` 的 `.js` / `.wxml` / `.wxss` / `.json` 运行代码中检查这六个 basename 引用；排除来源证据 JSON 自身后，命中 **0**。迁移前对动态路径、import / require、CSS 与文件系统读取的盘点见已冻结预算审计；不存在需要重新解释的新运行引用。

本次检查输出：`/private/tmp/caper-wave66-main-budget/relocation-check.json`，结果 `PASS`，`movedJsonCount = 6`，`allOriginalBytesAndHashesEqual = true`，`runtimeReferences = []`，`sourceMainBytesRemoved = 40291`。

没有运行全量测试、CI、微信 CLI / SDK / computer use，没有进行 Git 操作，没有重复字体、几何或业务绑定验证。

## 边界

主包中仍被页面使用的图片、SVG 和二维码依赖继续保留原路径与字节。六份来源证据迁出不会改变现有页面的 glyph、字体、图片、交互或路由；该判断依据其运行引用为零。本次没有增加真实 AppID、域名、订阅消息、真机或真人活动的验收证据。
