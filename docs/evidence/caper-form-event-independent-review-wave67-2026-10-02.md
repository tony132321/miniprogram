# Wave 67 — FORM / REVIEW / PG05 / PG05-S 独立来源审查

日期：2026-10-02。审查者：独立 source reviewer `/root/ui64_review`。

**结论：冻结版本未发现仍阻断本批原稿稳态恢复的源码缺陷。原稿数值、必要图形、作用域、绑定和旧分支保护已作独立来源核验。此结论不等于原生字体、按钮实点、分包编译、报名业务、全部 39 页面或逐像素验收通过。**

本次仅写本证据和独占临时审查文件，未改产品、他人证据、矩阵；未调用 Git、微信开发者工具、CLI、SDK、CUA、全量或业务测试。实现者已通过的 projection VM 未重跑。

## 1. 输入和冻结边界

依据批准计划 `docs/superpowers/plans/2026-10-02-tab-form-registration-reference-ui.md`，先完整阅读下列四份 HTML、查看四份 PNG，再审实现。基线是 `a8486175a3bfb3a70f475725b4901d1cf9de603b` 的不可变文件快照 `/private/tmp/caper-ui66-immutable-rt5d0gtu`；不是从当前会继续迁移的工作区推断旧稿。

原件目录：`/private/tmp/irl-stitch-original/stitch_design_system_generator`。PNG 的导出像素宽度不是 CSS 单位；下列实现恢复原 CSS 的字面 px，不按 PNG 或 750 设计宽度换算 rpx。

| 来源文件 | Bytes | SHA256 |
|---|---:|---|
| `caper_ai/code.html` | 43,225 | `baa9cbbb84c513529e4df1f7efdaec4057a9585993242983565fd58d5b461628` |
| `caper_ai/screen.png` | 200,437 | `233c1db76acebe257d35350c33b5c8bae5ebf435a02f09b90b945072d2153dd5` |
| `pg04/code.html` | 15,626 | `d61b1b9d6d221cf03ef4ab9d1c8218ea004e2594ce3638f95a35dfbf7f43f2a7` |
| `pg04/screen.png` | 265,612 | `9df8eb1764604bd81f7ecc6f5d2125a9f0ff4ec07e2056b9ad45dd3a40b65bb3` |
| `pg05/code.html` | 17,811 | `a016c7725aebb5eeb0ceaad0664651f723a78459738b049fc4c51fa652ac0075` |
| `pg05/screen.png` | 386,681 | `96167d34204721512ade34dedf01313894b09b68147865b5a104015a3679d63b` |
| `pg05_s/code.html` | 26,407 | `cc462e2d55b767cac1abae42cae61ff796dafbdb265941538d908f9d39dafd27` |
| `pg05_s/screen.png` | 295,313 | `01517b01a2b6438d4851f70ce262c54a05ecba9da04cf051ae643cbb50667136` |

B 最终清单：`/private/tmp/caper-wave67-create/frozen-owned-hashes.json`，28 条路径核对一致。C 最终清单：`/private/tmp/caper-wave67-event-prep/frozen-paths-wave67-event.json`，27 条路径核对一致；其清单 SHA256 `7e54cbee2533fca7b994337557624be4c08fdf12c79981ccfe65e9bc37600559`。

C 冻结后、root 迁移前，完整复制这 27 条路径到 `/private/tmp/caper-wave67-form-event-review/event-final-snapshot/`；复制时每条 bytes / SHA256 与 owner 最终清单一致，已通知 root 可以迁移。本报告 C 产品哈希与保护证明始终指旧 `pages/event` 最终产品，不会把随后旧入口兼容 stub 当成失败，也不替 root 声明迁移通过。

| 最终产品文件 | Bytes | SHA256 |
|---|---:|---|
| `miniprogram/pages/create/create.js` | 41,649 | `756912f00f8fbf590461d644041b9dac151e1783e630c68f335ad9cbc3bdb3e5` |
| `miniprogram/pages/create/create.wxml` | 59,070 | `1f43b903963036f7bfdfd0a86c108eed46e4d550a94b58110cd4745e2159700c` |
| `miniprogram/pages/create/create.wxss` | 59,578 | `5daf66279379e432f3b17246b4b1fd7bf21495aae802164452285d5432623f8e` |
| `miniprogram/pages/event/event.js` | 104,032 | `7aba63388c13daae75f2485cf31bea5ab0bd7db1a1568e293a03b31240fd7605` |
| `miniprogram/pages/event/event.wxml` | 100,072 | `c2dd55c68a3123d9969c204df0d1e91ccca69e53dda4ae5c921a12041eeb9720` |
| `miniprogram/pages/event/event.wxss` | 120,006 | `94049293bebaf3889760403fb43de4b0a3710f82de40d3d0655e54ef5074e6af` |

## 2. B：FORM 和 REVIEW 来源、级联和保护

### 原稿数值及原生适配

- FORM 主内容和固定 action 按 `caper_ai` 原稿限宽 420 px；REVIEW 主内容和固定 action 按 `pg04` 限宽 400 px。布局恢复原间距、字号、颜色和边角，未把限宽误放到只包含普通旧表单的 context。
- FORM 导航原内容高度 52 px；logo 32、品牌 16 / 12；hero 24 / 30；prompt 14 / 22.75、三行 68.25；分类 gap 8、emoji 24、标签 11；卡片 padding 16 / radius 16；日期四列与原小字号；海报选择保留 3:4 和 80 px 小预览。Chalkboard SE / Comic Sans 原系统栈未改成其他手写字体。
- 微信 status / capsule 使用真实既有 inset。品牌宽度由 `--form-draft-right:{{headerActionInsets.draft}}` 决定，`calc(100% - var(--form-draft-right) - 86px)` 中 86 = 原草稿按钮 78 + gap 8；品牌内节点 `min-width:0` / `overflow:hidden`，不再使用固定 208 px 假设。
- FORM action 原 bottom 64 px 与该稿 Tab 原内容高度 64 px 联动，再加入真实 safe；原 padding 10 × 16、gap 12、1:2 比例和 420 限宽保持。REVIEW footer 原 400 限宽、padding 12 × 20、32 px 原底部空间再加实际 safe、gap 14、36:64 比例保持。原手机 852 px 假容器、假 status、假 home indicator 未复制到产品。
- REVIEW heading 17 / 25.5 / 700；banner padding 14 / radius 16 / orb 44；行 label 14 / 21、icon 16 / stroke 1.8、gap 12。场地及报名截止独占 `review-value-compact` 恢复 13 px，保持继承 21 px 行高；时间二级为 13 / 17.875 / `#6B7280`；费用及可见性二级为 12 / 16 / `#9CA3AF`，后置独占类确实覆盖通用 multi 样式。
- 原稿未定义的 `rounded-2xs`、`shadow-xs`、`shadow-2xs`、`active:scale-98`、`w-13` / `h-13`、`py-0.2` 未凭视觉猜值。实际有效 px 与父级继承、后置规则分别核对。

### 已反馈并修正的具体问题

独立审查发现 FORM / REVIEW 限宽、固定 action context、两处 REVIEW 13 px 和窄屏品牌 inset 问题，直接反馈 B owner；owner 修正后只复核实际修正处。owner 自检进一步细分费用 / 可见性二级 12 / 16 / gray400，也已按最终 CSS / WXML 复核。真实 visibility 仍按 R1 状态映射为“受控公开 / 待运营审核”或“仅邀请 / 仅受邀成员可访问”，不复制原稿不适用于本业务的公开承诺。

### 独立保护结果

独立临时结果 `/private/tmp/caper-wave67-form-event-review/create-final-source-check.json` SHA256 `69c11d407194acb5ad18a7ec2b0aa7481b0f4810d837f4a692c4d022648e007a`：

- 28 条最终清单路径 bytes / hash 全部一致；FORM 和 REVIEW 新分支分别限定 `stage === 'FORM' && !editingEvent`、`stage === 'REVIEW' && publishPreview && !changePreview`。
- 原 editing FORM、changePreview REVIEW、原 header 内部、IDEA spacer / notices / 内容逐字节保护；整个旧 CSS 29,928 B 保留完整前缀，新增 214 条 selector entry 均在新 scope。
- JS 只新增日期和 review 文本显示投影及对应 data / onShow / summary 接入；按四处明确增量逆还原后原 JS 全字节相同，SHA256 `ed71d3750551182c6676c8c71e204f1396343d5f5eb46a84f6fde1ff0847d4ef`。身份、接口、规则、payload、版本、发布和导航未变。
- FORM 原真实 mutation bindings 64 → 73，无缺失；REVIEW 原 publish / back bindings 15 → 15，无缺失。此为静态保护证明，未假称每个按钮已原生实点。
- 23 个新 inline SVG 共 6,000 B：原 children 字节完整相等，root 仅将原 `currentColor` 与 viewport 按有效来源具体化；原缺 viewBox 的 REVIEW back 24、banner chevron 16、row chevron 14 仍缺 viewBox，未补视口而改变原绘制缩放。全部新增资源均被实际引用。
- 该页不引入 Material / Phosphor 替代 inline，也不加整份图标字体。FORM calendar / pin 准确 `#94A3B8`；REVIEW grey `#374151`、stroke 1.8、crown `#F59E0B`、chevron 原灰度均按来源区分。

owner 的 59 项保护 / 15 项纯 projection VM 已在其实施证据留存，本审查未重跑；最终 12 处局部修正由 owner 逆除确认回到已保护快照。

## 3. C：报名确认和真实 JOINED 来源、级联和保护

### 原稿数值及原生适配

- PG05 仅限定 READY + `joinConfirmation.isBadminton`。原 header 内容高 44、touch 36 / glyph 24、title 16 / 24 / 700，真实 status / capsule inset；内容和 footer 原 425 px 限宽、scroll padding 12 × 16 与真实底部 safe。
- 海报原 aspect 4 / 3.3、padding 20 / radius 16、三色蓝渐变；192 / 176 glow + blur 24；圆盘 96、emoji 36、shuttle 44；标题 Rubik Mono One normal 400、原 synthetic italic、26 / 1.05、旋转 -2° / scaleY 1.05 / 黄色和 text shadow。Caveat 原唯一请求面 700用于相应原手写角色；全局准确 payload 另有独立字体报告，不由这里声明 native font PASS。
- 活动卡 margin 16 / padding 16 / radius 16；title 18 / 24.75、facts 13 / 19.5 / gap 10 / icons 16；rules 11 / 13.75 / padding 10；choices gap 10 / padding 14 / radius 12 / selected border 2 / radio 16 / check 10 stroke 3。只一个真实选项时占完整列。
- PG05 footer 原 gap 12、padding 12 × 16、cancel 96、12 / 16、radius 12、最低 12 与实际 safe；原 footer 确为 `backdrop-blur-md` = 12 px。曾收到的 blur 疑点经完整原 HTML 排除：无效 `backdrop-blur-xs` 在 poster 圆盘，当前圆盘没有自补 blur。
- PG05-S 原 header 内容高 56 / back 44 / glyph 24 / title 17 / 22 / 600；原 person 外 wrapper 44、内 blue circle 32、glyph 18。旧实现 32 button + 12 margin 几何占位相同但触区不同，已反馈并在最终 WXML / CSS 恢复完整 44 外触区和 32 内圆。
- 新成功页 80 green check / FILL1 glyph 42；原 stickers 11 / 14、±12°；headline 22 / 28 / 700、copy 15 / 21 / max320；ambient 原 256 / 224 / 192 与 blur 64 / 64 / 40，offset 迁入真实 status + 56 内容坐标。
- 原活动票卡 banner 112 px 改为 minimum 以容纳真实长标题；tennis 130 / white / opacity .2；16 px divider、24 px cutouts、原虚线；fact icons 36 / glyph 20、labels 11 / 14 / 700、values 17 / 22 / 600；fee 保留原 CSS 500，源只请求 Jakarta 400 / 600 / 700 / 800，缺 500 应由字体匹配取 400，不另造一个 500 payload。
- 公告 padding 16 / radius 16、forum 18 on 28、heading 17 / 22 / 700。原 `pg05_s/code.html:149` 明确有 `font-bold`，本人初次对 600 的疑点经回读撤回，产品正确保留 700。roster 原四列 gap 10 / avatar 44 / label 11；rules padding 14 / icon 28 + 18 / copy 13 / 17.875；footer 原 buttons 48 / gap 12 / 1:1.5 / share 48 / arrow 18 / share 22 / max448。
- 新 selector 均后置隔离，`.event-page.pg05s-reference` 覆盖旧成功容器背景 / spacing；未让这批 PG05-S 字体或 padding 进入 PG01、普通 detail、host/member、PUBLISHED 或 generic JOINED。真实 safe 替代原假 home indicator。

### 真实业务映射

PG05-S predicate 必须同时 READY、JOINED、羽毛球、本人报名 CONFIRMED。原 JS 唯有服务端回读 CONFIRMED 后才设置 JOINED，产品未新增状态注入。原 JOIN / INTERESTED、审核、候补、取消、提交 disabled、版本和真实活动事实保留；INTERESTED 未改叫候补。原稿固定票码、假 QR、微信群、固定余席、示意头像和昵称、免费转让承诺未充当真实结果。

公告、报名与成员、签到、行程、详情分别绑定既有真实 handler；地点按钮明确“复制地点”并绑定既有 clipboard handler；头像样式入口明确“查看报名与成员”。昵称仍来自有 consent 的 `memberCards`，人数含候补的边界继续显示。未开放报名留言的接口状态如实呈现，没有新造一个可提交的 textarea。

### 独立保护结果

最终快照结果 `/private/tmp/caper-wave67-form-event-review/event-final-independent-source-check.json` SHA256 `3dbec325a89881c90bb27cf24c38aee37040983da99f886ee99ffb43616cea50`：

- 27 frozen paths 匹配；4 个明确 WXML 操作逐一逆还原后整个旧稿 87,816 B 完全相等，SHA256 `265efb383b028a8368166578b04f78f03493020180fdf2363b7aefbd33aaa744`；保护全部旧分支内部结构，而非仅几个示例片段。
- 旧 CSS 98,830 B 完整前缀相等，SHA256 `72bd3f539753dc0c2bbb2da5dcce33fd1ee6514d0dcbe71f7ded3268e7b5f4f9`；165 新 selector entries 都在 `.pg05-reference` / `.pg05s-native-*` / `.event-page.pg05s-reference` / `.pg05s-reference` 下，新增 CSS 无 rpx。
- 原 event.js 104,032 B 全字节相等。原 literal event bindings 160 → 177，无缺失；新增 17 个绑定对应 11 个既有 handler，全部在未改 JS 中找到：日历、复制地点、确认 / 取消 / 参与选择、返回、更多操作、五个 section jump、行程、详情、分享。
- 43 次静态 image 引用 / 39 个唯一路径均能在最终快照、不可变旧产品或准确复用资产中解析。资产来源 manifest 不因此混入产品。
- 新 8 个 PG05 inline 共 2,532 B，直接从完整原 HTML 以原 SVG hash 定位，children 字节完整相同，root computed viewport / color / stroke 完整匹配；没有用形似但不同的 PG01 图标替代。
- 新 13 个 PG05-S Material 共 4,887 B，与 pinned 官方 commit `bd8cb85bd4bad964fe6918f79665bb40c3a8efef` 的本地原文件逐节点属性 / 子树相等，只补有效 fill / xmlns；全部 opsz24 / wght400 / GRAD0，check FILL1，其余 FILL0。display 42 / 130 不误改变 opsz。原 `chevron_right` 继承 parent blue，准确 `#004CC8`，不沿用旧 gap audit 的灰色推断。
- 既有 `create/assets/back.svg` 和 `person.svg` 复用 path / viewBox / 色分别与官方 geometry 相等；原资源是 lowercase hex，与 uppercase 原色等价，不是颜色缺陷。

第一次独立静态核验执行到复用 SVG 色值时，验证器把 lowercase hex 与等价 uppercase 当成不同而中止。仅修正独占 verifier 的大小写归一化后完成同一必要源码检查；无产品改动。记录 `/private/tmp/caper-wave67-form-event-review/source-check-harness-note.txt`。未将该验证器误判包装为产品修复或原生失败。

## 4. 包体、其他审查和剩余边界

| 本批产品增量 | 原始 bytes 增量 | 新 SVG |
|---|---:|---:|
| B FORM / REVIEW | +67,444 | 23 个 / 6,000 B |
| C PG05 / PG05-S | +40,851 | 21 个 / 7,419 B |

这是源码原始字节，**不是 CLI 主包压缩结果**。此前主包只余 3,063 B，本批不能靠 raw delta 宣称已满足预算。B 来源 JSON 10,862 B、C 来源 JSON 69,214 B 和 HTML / PNG / 官方来源字体档案均在 docs / 独占 tmp，未新放进 main；也没有新增整份图标库、照片或重复字体。root 独占后续 event → activity 迁移和实际包测；迁移后的同字节 WXML / CSS / assets 与 5 个 JS require 深度变化由 root 另核，不在这里推定通过。

全局 6 faces、Caveat union、Rubik / OFL、旧字体和 loader / app / H3 保护，以及 event-entry 的参数、隐私、retry / stale / unload / 返回源审查，已单独冻结在 `docs/evidence/caper-registration-fonts-independent-review-wave67-2026-10-02.md`。本报告不重复该字形核验。

仍需由 root 本批限定运行证据回答：微信实际字体是否加载、native capsule / narrow width / safe 位置、分包旧 URL 兼容、真实服务端报名回读、各受影响按钮实点与长页返回。原 PG05-S 随机 confetti / bounce / pulse 和 prototype toast 没有迁入业务 JS；实现者明确本批复原原 PNG 的稳态，因此这里不声称动画也逐帧一致。原稿中的不可用示例动作没有伪装成已实现业务。

本独立结论只覆盖这四个明确分支；不作整个项目、所有 39 页面、真机、真实订阅、线上服务或真人受控活动的 PASS 声明。
