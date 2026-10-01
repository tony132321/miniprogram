# Wave66 主包空间只读审计与后续方案

日期：2026-10-02。审计owner：`/root/ui65_font_audit`；媒体精确引用独立协助：`/root/ui64_review`。仅写本报告；没有改产品、配置、总矩阵、Git或微信，没有运行全量/CI/SDK。本文件冻结时，六份来源JSON仍在原main目录。**后续方案不计作本批已实施的空间优化，也不证明本批预算或编译通过。**

## 1. 边界与已经启用的配置

按当前 `miniprogram/app.json`：8个主包页为index/discover/create/messages/me/event/city/about，profile分包10页、activity分包2页。两个分包根分别`subpackages/profile/`、`subpackages/activity/`，其余miniprogram文件计作源码main候选。

根 `project.config.json` 已有 `setting.minified=true`、`minifyWXSS=true`、`minifyWXML=true`。本审计不会重复建议这三项已启用的设置；`packOptions.ignore/include`均为空。私有开发配置`ignoreDevUnusedFiles=true`、`bigPackageSizeSupport=false`已读；前者可能影响开发编译的未引用文件过滤，其对CLI preview打包的实际贡献本审计未测试，不能据它保证某证据文件已排除，也不要求打开大包支持。

最后根代理提供的超限preview为2098454 B；随后字体许可正文去重已独立冻结，模块186228 B、源码省4342 B，详情见 `docs/evidence/caper-font-license-dedup-budget-wave66-2026-10-02.md`。修正后的真实preview由root测；本文没有新的compiled包体数字。

## 2. 原始文件盘点

全部miniprogram源码文件417个（含OS隐藏文件），按上述根划分：

| 区域 | 文件数 | 原始B |
| --- | --- | --- |
| main候选，含.DS_Store | 163 | 2217732 |
| subpackages/profile | 220 | 1026610 |
| subpackages/activity | 34 | 94660 |

main的`.DS_Store`6148 B是OS元数据；没有实际包文件清单确认其是否打包，不把它计为保证可节省收益。排除该文件的main源码合计2211584 B。**源码合计不是编译主包大小**，不能用它判2MiB；压缩/编译及文件过滤会改变值。

| main类型 | 文件数 | 原始B |
| --- | --- | --- |
| .json | 17 | 42345 |
| .js | 18 | 549328 |
| .wxss | 10 | 275115 |
| .wxml | 9 | 211981 |
| .jpg | 16 | 1095146 |
| .svg | 91 | 37346 |
| .md | 1 | 323 |

main真实媒体合计107份／1132492 B，其中16 JPG共1095146 B，91 SVG共37346 B。文件大头如下，仅用于定位；当前UI和完整字体字节均保留，不提出降低画质、裁字体或删原图：

| main文件 | 原始B |
| --- | --- |
| `utils/reference-font-data.js` | 186228 |
| `pages/event/event.js` | 104032 |
| `pages/event/event.wxss` | 98830 |
| `assets/stitch/caper_discover_boardgame.jpg` | 93870 |
| `assets/stitch/caper_home_hiking.jpg` | 91338 |
| `pages/event/event.wxml` | 87816 |
| `assets/stitch/caper_discover_camping.jpg` | 84585 |
| `assets/stitch/caper_discover_basketball.jpg` | 80784 |
| `assets/stitch/caper_discover_coffee.jpg` | 75091 |
| `assets/stitch/pg09_expense_rooftop.jpg` | 70223 |
| `assets/stitch/caper_discover_art.jpg` | 70164 |
| `assets/stitch/caper_home_dinner.jpg` | 69929 |
| `assets/stitch/pg08_checkin_rooftop.jpg` | 67426 |
| `assets/stitch/caper_discover_citywalk.jpg` | 63210 |
| `assets/stitch/pg04s_badminton.jpg` | 63131 |
| `assets/stitch/caper_discover_surf.jpg` | 61363 |
| `assets/stitch/itinerary_badminton.jpg` | 60640 |
| `vendor/qrcode.js` | 56694 |

`utils/reference-font-data.js`前181500 B的五字体资源已核原字节，本次不进一步切subset、换字形或修改字体加载。`vendor/qrcode.js`也不能仅因activity/share引用而搬分包：main `utils/checkin-qr.js:1`导入它，main `pages/event/event.js:2`导入签到QR绘制，真实签到仍依赖main的该模块。

## 3. 优先后续方案：六个无运行引用证据JSON

下列六个文件全部在main路径，合计**40291 B**。它们记录官方来源、asset/hash和设计追溯，应用运行不读取这些清单。检查范围是全部运行JS/WXML/WXSS与实际page/app JSON，排除了证据清单自身的sourceURL/filename以防把自描述当运行引用；额外核repo运行/工具脚本的明确清单名引用未找到。现有require/import均为可解析字面模块路径，未发现变长文件名读取、readFile/readdir/getFileSystemManager、request这些清单或目录遍历。

| 原main路径 | B | SHA256 |
| --- | --- | --- |
| `miniprogram/pages/discover/assets/phosphor-sources.json` | 8205 | `f4f229a006e06bd1388752ac0921d07ddb3415251ec64bfebd3fb7d1588382d2` |
| `miniprogram/pages/city/assets/material-symbols-sources.json` | 8605 | `44814d81d20c1006a38a94b36f2b30f8b61171359c8ca67366e4d41214f703f4` |
| `miniprogram/pages/about/assets/reference-logo-sources.json` | 626 | `e69657e858780910ed22ab7318ad7fc6a62ae7572af1daf6a1a0ea58f76ffdad` |
| `miniprogram/pages/about/assets/material-symbols-sources.json` | 9352 | `53398a62e0e27af0f2e7396775d538dc88f07d40395ac20f3865d55b20757293` |
| `miniprogram/pages/me/assets/source-manifest.json` | 8090 | `1fef1e21fc1599a1b4f83119dd05becc06a6c2a7a86e82fdd8e1fdd37c88b4ba` |
| `miniprogram/pages/index/assets/manifest.json` | 5413 | `0d1c73ad8483d1e016e828260ecbbdbaf3999a422d365446fae1d1d8893aca99` |

具体可实施方案：**原字节**移到`docs/design-sources/main-package-relocated/`，保留旧→新路径/hash映射；历史实施报告的旧路径通过迁移mapping和新文件可追溯。无需更换SVG/图片/font、运行JS、UI绑定或配置。影响来源文件对应index/me/discover/city/about，但运行页面DOM、图形和跳转无变动。

主包源码路径净移出40291 B，docs仍完整保留40291 B；这是原始文件净差额，实际compiled主包节省可能不同，root下一次preview必须实测。此优先级大于当前SVG重复去重，且不用动任何产品路径。

主包`vendor/README.md`另有323 B、无运行引用；可原字节移docs保存归属，但`.md`是否被preview打包未知，不把它并入40291 B保证源码方案，也不删`qrcode.js`内原MIT版权/许可。分包内其他来源清单不占main，搬它们不会给main提供40291 B以外的额外收益。

## 4. 精确同字节重复SVG：后续小额方案

全部图片/SVG按SHA分组，只存在下列3组包含至少两个main copy；JPG16份全部不同字节，没有可按同字节去重的照片。

| main文件组 | 单份B × 数 | 可少装素材B | 完整SHA256 |
| --- | --- | --- | --- |
| `pages/city/assets/person.svg` / `pages/about/assets/person.svg` / `pages/create/assets/person.svg` | 544 × 3 | 1088 | `d66a89fc9036f18a31f3804ee7b19f52a7954e31cc1cbfbd9b98f206a8299d6f` |
| `pages/city/assets/arrow_back_ios_new.svg` / `pages/about/assets/arrow_back_ios_new.svg` / `pages/create/assets/back.svg` | 173 × 3 | 346 | `b4d72b3ef91399480f63d49489df5b8ff1b26436974b423b3c60d11b103ff854` |
| `pages/city/assets/more_horiz.svg` / `pages/about/assets/more_horiz.svg` | 423 × 2 | 423 | `51e679c18d8ef69ac46b006148167c62824958920f54eced6bd828d24a3ee7c4` |

素材总共1857 B可共享。具体选择已存在的city原副本，不新增另一份shared copy、不画新path：

- about.wxml的person、arrow_back_ios_new、more_horiz三个`./assets/...`引用各改为准确`/pages/city/assets/...`，代码路径字符净+30 B。
- create.wxml的person、back两个准确绝对引用改为city对应person/arrow_back_ios_new，代码路径净+10 B。
- 移出about这3个重复副本、create这2个重复副本，源形状、fill、viewBox与hash均完整相同。应在docs保留迁移源/输出映射与历史来源记录。

因此该**具体**方案main源码净节省 **1817 B = 1857−40**，不是泛称1857 B净收益。受影响只为about/city/create相应header图形读取；五个src一一存在，没涉及动态文件拼接或UI几何/业务绑定。root当前只采纳前述六证据JSON，本审计没有实施此五src方案。若后来采纳，需要相符局部资源/图形检查和实际preview，不重跑无变更的整个业务矩阵。

其他重复组要么都在分包，要么只有一份main加分包copy；不能删main所需副本或让main依赖尚未加载的分包来虚报main空间收益。本审计不把全项目总重复当main重复。

## 5. 所有main媒体的精确引用与分包候选

并行独立协助者先按app边界散列，再解析绝对/相对WXML引用、JS数据literal、CSSurl、import/require和动态src来源；已读其完整结果。107份main媒体全部至少一处可解析main引用：

- 当前仅分包引用的main媒体：**0**。
- 当前完全未引用main媒体：**0**。
- 缺失或未解析的本地literal媒体路径：**0**。
- 16 JPG都有main引用，不能把仅一个main页面使用误认成分包素材。

若干必须留main的准确证据例子：

| 媒体 | main使用位置 |
| --- | --- |
| caper_home_dinner.jpg69929 B | index.wxml41/69，虽moments.js57也使用，仍非分包专属。 |
| pg04s_badminton.jpg63131 B | event.wxml29，已发布页真实示意封面。 |
| pg09_expense_rooftop.jpg70223 B | event费用区动态src字面分支，属于main。 |
| pg01_badminton_player.jpg36028 B | event.wxml47普通访客原海报。 |
| itinerary_badminton.jpg60640 B | itinerary.js21之外，event.wxml164/238在main签到/费用区也使用。 |

动态src共有23条，不能只搜WXML里的完整图片名就删素材。实际来源包括：

- main index.js161–168 `coverFor`→304展示值；discover.js5–21原数组与31–37 `coverFor`→132/234；me.js193–202 `activityCover`→421。
- custom-tab-bar.js2–6明确8个nav文件，custom-tab-bar.wxml5按selected状态选icon/selectedIcon。
- activity/itinerary与share `coverFor`、profile/moments `eventIllustrations`均是完整静态路径列表；badges/moments图标由明确数组解析。
- 没有filename片段拼接生成main媒体，也没有媒体import/require或CSSurl造成漏算；模块require已单独读，不当图片。

API提供的将来内容、用户头像/临时本机文件以及未测试的编译路径并不是可证明空闲的源码资产，标记为运行数据/未知边界，不能用“静态无引用”推导用户媒体可删或显示不会变化。这里“0未解析”仅对应本仓库现有本地literal与已追踪字段，不是对所有外部运行值的全知声明。

## 6. 可复核原始输出与freeze

本owner盘点：`/private/tmp/caper-wave66-main-budget/inventory.json`，含main/sub原始类型、大小、hash与重复分组；具体5src方案`exact-svg-dedup-proposal.json`。

独立媒体精确引用原输出：`/private/tmp/caper-wave66-budget-review/exact-media-reference-scan.json`，62724 B，SHA256 `e2455b9fa9af8624231f353a94b7892633c5b2ddaf4ebfc99a531dae9b142d7c`，包括107项文件/准确引用、23动态src和60个模块import条目。只读，未运行微信、SDK或新测试。

报告冻结时六JSON的真实bytes/hash仍为表中原值；后续经root授权的证据搬迁应另写独立迁移证据。本文只给原字节保持的可执行方案，**不计作本批已优化或任何预算门槛已通过**。最终main<2MiB及GitHub同tree发布只能由root的真实preview与提交证据确认。
