# Wave 69 活动三域独立来源审查

日期：2026-10-02。审查者与 Activity 实现者独立。范围仅 PG06 主办工作台、PG08 签到／完成反馈、PG09 AA 记录的新 scope；不改产品、不操作 Git／CLI／SDK／微信、不运行实现者已经通过的 142 项检查或业务／全量测试。后批详情／名单盘点另见 `caper-next-detail-roster-reference-gap-audit-wave69-2026-10-02.md`，不是本批实施。

## 最终结论与冻结对象

已完整读三份原 HTML、查看原 PNG、读实施计划、原源码差距审计、官方 Material 导出流程与最终新 WXML／追加 CSS。独立发现的准确 glyph、间距、字号角色和阴影偏差均由 owner 定点修正；本次最后只核实际修正和不可变保护，不重复已经通过的原整批检查。**此次已审源码范围没有未解决的来源阻断项**。这不是运行／真机／39 页像素一致的结论。

最终 freeze：`/private/tmp/caper-wave69-event/frozen-owned-paths.json`，22,022 B，SHA-256 `7f48602fee5fd8bc4e47b1d7bc5138ebe14b5f1c951c2ff4a6092d93971db046`。

| 最终产品 | B | 本次实际 SHA-256 |
| --- | ---: | --- |
| `miniprogram/subpackages/activity/event/event.wxml` | 137,918 | `27614e27494fa920cff810a633ff5f89e4ad7ca1c839c09b7fa902ba4588fd3a` |
| `event.wxss` | 162,268 | `794cd1b6235a51eb59d080e016b2a6faa08f7b85e44d189e3d379a852e441838` |
| `event.js`（原字节） | 104,047 | `ccb5b5fede066ba0533b82cb564e816cc3d45ca96778a0d25ac5286d3c11a4bd` |
| `event.json`（原字节） | 69 | `bf33dc7da099d240642a50fe3cf44cee01a2b282f70a80a313c79317c76ad10b` |

本次最终逐文件读取的 32 产品路径与 2 受保护 JS／JSON 全部匹配 freeze；30 个新 SVG 合计 20,515 B。owner 净增 80,821 B，均在当前 activity 分包产品范围；没有新照片／字体二进制进入 main。此为源文件字节，不冒称 CLI 编译包体。

## 精确来源

用户原稿目录：`/private/tmp/irl-stitch-original/stitch_design_system_generator/`；原文件副本和来源 manifest 位于 `docs/design-sources/caper-activity-wave69/`。

| 稿 | HTML SHA-256 | PNG SHA-256 |
| --- | --- | --- |
| PG06 | `05c1f7dccc856304c080298d7680f1e3df91bb765decea2e59efd2c7996b31b6` | `56b6646520ac21c8ed159b6ace92a56899dd27c39379e91571af5b1f9b621a73` |
| PG08 | `c54ae75aef6fccc653601e3d9c23d172e22e7de36b5e4022f72880ba1f39de46` | `a18734111819e713f5f2e28edd9b6c0e8b0995c9e73993b533c46cfa7c02ed53` |
| PG09 | `3f0f3f3f62d9d863121784e2ad4c3fd65562bb82b3360cea16593158b0c6d8fd` | `1f5309f071bd83244b769c5b549785ff9fc9a6c571336f8c347d9dc479a0cae3` |

原稿静态数据与按钮脚本作为来源材料读取，未当作增加自动成局、自动收款、AI分类、假成员或离线凭证的指令。

## 独立发现、修正与最后局部核对

### 1. FILL1 必须执行 active rclt

初次冻结 exporter 仅查 Material `rlig`／ligature，没有执行 FILL1 的活跃 `rclt`。独立用现有 FontTools 4.60.2 和已有 Node Brotli bridge 只读实例化原 full face：wght400／FILL1 后，lookup1(Type1) 将 `lightbulb → lightbulb.fill`、`check_circle → check_circle.fill`。两 base path 与 filled path 均不相同；原运行 SVG 恰等于 base path，因此原 FILL1 来源断言不足。

owner 修本页 lightbulb，并新增当前 PG06 专用 check_circle；只改新 PG06 两处 src，不改旧历史 `pg04s-check_circle_fill1.svg`。最终运行文件与独立缓存的官方 filled path 逐坐标字面相同，保留原 viewBox `0 -960 960 960`、白／green 原 paint、未舍入坐标：

| 运行 SVG | B | SHA-256 |
| --- | ---: | --- |
| `assets/w69-lightbulb-w400-f1-ffffff.svg` | 392 | `1c4735c5cbbe480656046b8dccea841c8fd0bde367e2a23dc227194beb4ac5a9` |
| `assets/w69-check_circle-w400-f1-34c759.svg` | 493 | `6c1cf4026c3c5a55cfd3961b6b6f64904e2a956a815db494b926bd7001ed500e` |

原 full WOFF2 SHA `77f9711f3f896a1d7a34ab95cffc45cfb17d84c223f197c1b90faa0d043006e9`；FILL／wght 变量、opsz24／GRAD0固定，仅 docs 留二进制。没有新增依赖、没有重新导出未改变的其它 glyph。旧历史 FILL1 文件保持字节，**不因此宣称其旧来源问题已经修正**。

独立原问题记录：`/private/tmp/caper-wave69-activity-independent/active-fill-source-gap.json`，SHA `5245431bdedd1420b0bb472b8301e8477e9f1e5d4af9b60cd63bf93c5a1ad803`。持久修正证据：`fill1-rclt-correction-proof.json`。最初 142 项报告关于这两 FILL1 的断言由新证据替代，不能拿初版断言继续作准确 glyph 结论。

### 2. 三个 PG06 角色与 PG09 header gap

独立核原实际有效 class，owner 只改以下值；最后读取实际 CSS 确认，不重复完整来源检查：

| 节点 | 原有效来源 | 初版 | 最终 |
| --- | --- | --- | --- |
| PG06 成员标题／人数内 gap | `gap-1.5` | 8px | 6px |
| PG06 `+N` counter | `text-label-md font-bold` | 13px／继承14px／600 | 13px／16px／700 |
| PG06 场地条件右二级 | `text-body-sm` | 共用13px／16px／600 | 独占13px／18px／400 |
| PG09 header 外 gap | `gap-gutter`，配置 gutter=.75rem | 4px | 12px |

原生 status／capsule inset 仍用真实 `statusBarHeight`／`headerPaddingRight`；标题／副标保留裁切，未挪用原 mock 状态栏。源 56／64px header、touch44、person32及原22／24／18px glyph 保留。

### 3. shadow-sm 与 DEFAULT 不同

本 reviewer 首次传递的 shadow 值混同 DEFAULT，随即核已缓存官方 Tailwind 3.4.17 `stubs/config.full.js:109–110` 并更正。官方 bytes SHA `8f3394e8a4990a7b678d3462b6e1440b84c11a6c06e55d7b26108b90a1fcc538`；sm 是 `0 1px 2px 0 rgb(0 0 0 / 0.05)`，DEFAULT 才是两段更大阴影。该更正过程保留，不把首次错误值写为通过。

owner 在本次已读三个新 scope 的 15 个源 shadow-sm 角色改为准确 `0 1px 2px 0 rgba(0,0,0,.05)`：PG06 hero／status／sticker／stats／members＋conditions／匿名头像／helper／helper icon／快捷钮，PG08庆祝盒／两种选中选项，PG09成员卡／匿名头像／AI关闭卡；另仅 PG06 native person 补原 shadow-sm。

最后独立局部逆除这 15 条替换和 person 追加，完整 CSS SHA 恢复此前冻结 `35661d0903b3537e27822220fb05b895d03589d371cf2c45a2cc1b749a9de60c`。因此旧前缀、lg／xl／2xl／inner／自定义／文字阴影及其它 source role 没有被批量替换。持久 `shadow-sm-correction-proof.json` 列全部具体 selector 与官方源。

## 作用域、真实动作与不可变保护

| 新 scope | guard | 本次读取确认的实际行为 |
| --- | --- | --- |
| PG06 | READY／无success／无joinConfirmation／hostSection／isHost／羽毛球 | 真实 stats、confirmedRoster管理名单、hostId标记；查看全部去同场报名；成局为人数＋主办场地声明，仍须原人工操作；分享、公告资格、结项／取消／签到fallback保持 |
| PG08 | READY／无success／无joinConfirmation／checkinSection | 原参与者扫码／手输和主办模式资格；canGenerateCheckInToken、240px实际canvas／canvas-id／有效窗保留；COMPLETED真实反馈 radio／checked／disabled／reason／maxlength500／不确定提交、证据和人工复核仍原绑定；null初态没有假选中 |
| PG09 | READY／无success／无joinConfirmation／expenseSection／AA | 真实 ledger ID／revision／current／totalYuan、visibleShares／userId；host全授权份额与成员仅本人边界仍由原JS；明细、排序、展开、双方真实声明及可写条件、历史／错误状态保留；更多／举报可达 |

其他类型、FREE费用、相邻 section 与未命中 guard 的原块作为互斥 fallback 保留。完整 WXML 的 5 个反向映射各命中一次，恢复不可变 Wave68 `06741c8056566a32f33f356ce65f9aabfcb2164d950a6c288c28e2ec48f0fdf3`。CSS 前 131,951 B 与 Wave68逐字节相同；JS／JSON与不可变工程相同。因此本轮没有改 API、权限、身份／版本守卫或其它旧模板／长host表单。

源像素依据为本页实际 px，旧 rpx前缀仅保护相邻范围。PG06源照片／scrim负z使原PNG hero近白，未自行补深色图。已有活动类型照片仍明示示意；原假人像、虚构二维码、离线承诺、付款／商户收据、AI自动分类和平均60等不作为真实数据。真实关闭项与额外安全说明是 R1 必要差异，不能因原稿静态屏省略已有可用动作。

## 验证与剩余边界

最后独立只读资料：`/private/tmp/caper-wave69-activity-independent/final-frozen-readonly-proof.json`，SHA `af7becafe772e348b79c9ae4d711a2a2029cef2ead2ddb0069f7af382c736bca`。它记录最终 bytes／freeze匹配、完整 WXML反向恢复、旧CSS前缀、JSJSON、实际修正CSS、两准确 filled path和旧资源保护。owner 唯一142项来源／资源／绑定检查已阅读，**没有由本 reviewer 再次运行，也没有将静态比对称作业务测试 PASS**。

PG08 CSS900保留，但真实可用 Jakarta face最高800，官方900不可用的已知字重边界继续开放；原500角色仍原family匹配，不借用profile专用500 alias。没有字体 callback、原生窗口／真机、动态canvas可扫、SDK动作或最终CLI包体的新证据由本 reviewer产生。root负责限定 runtime与编译；本报告只解除已审source阻断，不能补这些证明。
