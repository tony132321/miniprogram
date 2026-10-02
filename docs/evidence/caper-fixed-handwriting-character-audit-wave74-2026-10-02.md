# Wave 74 固定 Caveat 文案字符覆盖审计

## 结论

只读核验首页、发现、活动页共 **13 个 Caveat CSS 角色、21 段固定 Latin 文案**。当前字体存在 **2 项确定缺漏**，已交根代理补入官方来源的最小 union；本审计没有修改产品、字体 payload 或字重。

1. 发现 `.d74-route-hand` 的 **Wukang Road**：700 face 缺 **U+0057 `W`**。
2. PG01 访客 `.pg01-poster-bottom text:first-child` 的 **Play More**：实际匹配 600 face，缺 **U+0079 `y`**。

其余固定 Latin 文案字符均存在于对应 cmap。`☺`、`♡`、`⚡` 与中文均保持来源字体回退，不重画，不声明 Caveat 包含中文。修复后的 payload、原字形保留和原生加载结果由根代理另行证明；此表记录修复前的确定缺漏。

## 当前字体输入

通过本机 FontTools 4.60.2 `TTFont.getBestCmap()` 直接读取，不比较轮廓或字距。

| Face | 文件 | 字节 / SHA-256 |
| --- | --- | --- |
| 700 | `docs/design-sources/home-long-reference-fonts/caveat-700-home-discover-pg05-union.woff` | 28,076 / `f2fb6438cd2a04f9bcbb67fea2f9136208a99693156a533d1e2d8f28fb9628cd` |
| 600 | `docs/design-sources/home-long-reference-fonts/caveat-600-city.woff` | 11,624 / `65a31f27c6f651920868421bc775a63546e843e478f66b137fe52f5069098379` |

这是已保存最终字体的**字符映射**审计。700 先前新增 `E/H/O/T/u/v` 已覆盖 `TOGETHER` 等消费者，但没有大写 `W`；600 城市语句子集没有小写 `y`。

## 固定消费者来源表

权重栏为 CSS 名义权重 → 当前可用 Caveat face。完整 CSS、路径、行号、输入 hash、字符列表及来源在同名 JSON。

| 页面 / CSS 角色 | 权重 | 固定文案 | 对应 Latin cmap |
| --- | --- | --- | --- |
| index `.hero-kicker` | 700 → 700 | More People, Brighter Days ☺ | 全部有 |
| index `.feature-tagline`（真实卡 / 闭态卡 2 处） | 700 → 700 | Same Game & New Friends | 全部有 |
| index `.ribbon-hand` | 700 → 700 | Good People Better Days | 全部有 |
| index `.home-idea-doodle` | 700 → 700 | Good / Matches / Better / Friends | 全部有 |
| index `.home-photo-main>text` | 700 → 700 | Same People Real Vibes | 全部有 |
| index `.home-city-hand` | 400 → 600 | Good People Make Better Cities ☺ | 全部有 |
| discover `.featured-sticker-city .sticker-note text` | 700 → 700 | TOGETHER ☺（固定 JS 数据） | 全部有 |
| discover `.d74-moment-hand` | 700 → 700 | Good People / Brighter Days ☺ / Same Vibes / More Friends ⚡ | 全部有 |
| discover `.d74-moment-better-copy text:last-child` | 700 → 700 | together ♡ | 全部有 |
| discover `.d74-route-hand` | 700 → 700 | Classic Shanghai / Wukang Road / Coastal Sunset | **仅 Wukang Road 的 W 缺漏** |
| event `.pg01-poster-tagline text:last-child` | 800 → 700 | 好球友 总会相遇！ | 无 Latin；中文与全角标点回退 |
| event `.pg01-poster-bottom text:first-child` | 400 → 600 | Play More | **仅 y 缺漏** |
| event `.pg05-poster-note` | 700 → 700 | Good People / Great Rallies | 全部有 |

## PG01 600 匹配的依据

原 `pg01/code.html:10` 请求 `Caveat:wght@600;700`；95–97 的 `.hand-script` 只声明 family；174 的 `Play More` 是 `hand-script text-xl leading-none text-white/95`，没有粗细类。原祖先和当前 `.event-page` / PG01 海报 / art / footer / bottom 都不添加粗细，名义为默认 400。只有 600 / 700 可用时，400 匹配 600。当前未设置 weight 的实现保持这个来源条件，补字不应改成 700。800 的中文 tagline 匹配 700，仍通过系统或后续 family 绘制中文。

PG05 原 `pg05/code.html:53` 仅请求 Caveat 700，129 的 `Good People` / `Great Rallies` 由当前 700 完整覆盖。两个原稿的其他手写节点若未进入现有 Caveat scope，不纳入本次风险结论。

## 排除和证据边界

- 发现篮球 / 咖啡 / 桌游贴纸的 JS 英文虽然存在，但不匹配 city 专属 Caveat 选择器；没有把它们误计为手写字体消费者。
- PG01 `Meet Cool People ☺` 是 bottom 的最后一个节点，没有 Caveat family；`BADMINTON` / `TOGETHER`、发现 `LIFE IS BETTER`、首页 `Nice!` 及便签小字也有各自的非 Caveat 字体。
- 完整字符表最初预计只缺 `y` 的断言失败；诊断表实际又发现 `W`，随后纠正了审计脚本的预期，保留于 JSON 的 `auditHarnessHistory`。没有产品测试失败，也没有隐去这一漏报。
- 没有运行 UI / 业务 / 全量测试、轮廓与字距比较、VM、CLI、SDK、Git；没有重复根代理已有字体证明。cmap 包含不等于原生文字已完成绘制或逐像素验收。

证据：[完整只读字符表](./caper-fixed-handwriting-character-audit-wave74-2026-10-02.json)。
