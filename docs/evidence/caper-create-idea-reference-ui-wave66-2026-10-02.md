# Wave66 发起 IDEA 原稿恢复与局部检查

日期：2026-10-02。实施 owner：`/root/ui65_font_audit`。范围仅 `pages/create/create.wxml/.wxss`、页内 10 个 SVG、docs 来源清单、既有 header helper 两个几何常数。按已批准计划复用现有工程，不重写业务，不操作 Git、微信工具、全量测试或 CI。**这是源码与必要几何检查证据；不能替代微信编译、实际点击、字体字形、真机或完整 R1 功能验收。**

## 1. 原稿与固定来源

完整阅读并查看：

- `/private/tmp/irl-stitch-original/stitch_design_system_generator/pg03_ai/code.html`，20435 B，SHA256 `a9dcecb66acbfe35c004d66b178dd3594197b2d5b1688c6feaada09a30ca0497`。
- 同目录 `screen.png`，718 × 1600，486721 B，SHA256 `b6cfb7394783c1793a823be7065822a14ce38c635eaaead09467aa9506b78463`。
- 已批准实施计划：`docs/superpowers/plans/2026-10-02-messages-idea-visitor-reference-ui.md`。
- 上批 gap 审计：`docs/evidence/caper-next-reference-gap-audit-wave65-2026-10-02.md` 的 B 部分；当前 create WXML/CSS、header helper、灵感/路由/真实 suggest 与受保护发布流程。

源 HTML 第 1 行包含字体、主题、原 header、body family；第 2–154 行包含完整 IDEA 组件。Material 使用原 **Material Symbols Outlined** 家族，普通未设置 FILL 的 glyph：`opsz=24,wght=400,FILL=0,GRAD=0`。复用已有固定官方仓库与导出流程：

- [Google 官方 Material 仓库固定版本](https://github.com/google/material-design-icons/tree/bd8cb85bd4bad964fe6918f79665bb40c3a8efef)。
- `docs/evidence/caper-create-material-symbols-sources-wave66-2026-10-02.json` 每个项目保留准确 `sourceUrl`、source SHA、资产 SHA、名字、FILL、颜色与变换。
- [同版本 Apache 2.0 许可](https://raw.githubusercontent.com/google/material-design-icons/bd8cb85bd4bad964fe6918f79665bb40c3a8efef/LICENSE)；现有 `docs/licenses/material-symbols-Apache-2.0.txt` 与本地固定官方 LICENSE 字节相同。

未再下载图标字体，也未将图标字体加入主包。8 个原名称在固定版本全部有准确 SVG；只修改 SVG root fill，源 child/path/viewBox/所有其他 root 属性不变。八个源名称为 `arrow_back_ios_new`、`drafts`、`person`、`auto_awesome`、`send`、`cached`、`arrow_forward_ios`、`trending_flat`；箭头颜色不同共 10 个实际所需文件。source 脚本 `sync/check_circle` 的假策划完成状态没有接入。

## 2. 恢复的实际结构

| 位置 | 使用原稿明确 token／结构 |
| --- | --- |
| 顶栏 | fixed 白 82%／blur 24，原动作行 56 px／横 16；原返回 hit 44／glyph 24；草稿高 32、横 p12／glyph 17／间隔 4；profile 32／glyph 18。保留真 statusBarHeight、胶囊 rect 及真实草稿、个人、返回入口。 |
| Header 适配 | 实际 title 保留“活动构思”，不复制源页面编号。为原生胶囊预留实际 inset；title 字号仍 17，不靠缩字体放满。IDEA 中已知 draft 内容宽 17+4+39+24=84 px，title 右边预留该完整 pill；窄屏有 ellipsis，待根代理实机/模拟器确认。fixed header 用 status+56 的原生占位，不伪造 9:41／信号／电量。 |
| 主内容 | 横 16／顶 8／栈 gap 20；hero 顶 4、文字右 8，原 headline 22／700／tight1.25 和字距−.025em。保留真实“本地构思”“发布前由你逐项确认”“本地规则提取”说明与手动入口。 |
| 原助手球 | 原 80 px sphere／to-top-right #141b3a→#2d2963→#5856d6；两原 glow、2 s pulse；反光20×10／top8,left12／−45°／blur1；眼8×10／gap10／原 cyan glow；腮红6×4、width40、px4、bottom16、opacity70%／blur1；粒子14／left−4,bottom−4；原 tag 浅紫、top−12/right−4、p2×8／6°，源 10px label及 11px auto_awesome。 |
| Tag 收缩 | 原 absolute auto shrink-to-fit 的可用宽为80+4=84 px；恢复对应 max-width 与正常换行，保留 PNG 的 Your Social / Copilot 标签，不用一行 nowrap 拉宽。 |
| 输入 | 原 card r24／p16／min168 与两层 shadow；15px/400/leading1.625；源码 rows=4 对应 4×15×1.625=97.5 px 内容高度（微信 textarea 不使用浏览器 rows）；footer pt8／send40、glyph20的−12°/x2变换、原blue shadow；活计数 dot6和 source ping。保持 aiText/value/max300/bindinput 与两个 suggest disabled 条件。 |
| 灵感 | header pt4／17px600，popular12/700/p2×6/softpink；refresh13px600／cached16；卡 stack gap10、r18、p14、gap14；图形盒44/r14、20px源emoji和原 inner shadow；卡 title15/700/1.25、subtitle13/18/top2、arrow18。咖啡仅将展示字符 ☕ 加原 emoji variation selector 为 ☕️；业务数组、索引、available、title/subtitle/text 原封不动，第二批仍用已支持羽毛球内容。 |
| 页底 | 原 fixed tray 白82%／blur24，横16/top12/bottom32+safe；原按钮py14/px24、font17/600/line22、gap8、三段原 gradient 和 shadow、22px arrow／4s spin；保留真实手动按钮。content底部源pb96加手动按钮margin6+line18=24和safe，使末项可滚到tray以上。 |
| 字体 | IDEA 的原 body/font roles均为 Plus Jakarta Sans；只使用 Wave65 已注册400/600/700权重与 CJK fallback，不写 Wave65 任何加载器、字体资源或其他页面。字体成功加载和实际字形仍待根代理运行验收。 |

### 原源码有两处不能猜修复

1. 原 `h-13` 未在主题 spacing 定义，Tailwind 默认该项也不存在。生成按钮用原明确 py14／line22 自然布局，未设置“52 px”高度；本次没有把缺失类当成固定高度证据。
2. `vibrant-lime: "D2F803"` 缺 `#`，不能成为有效 CSS 填色。原 PNG 中粒子是透明背景与外光晕，底部箭头为白色；实际继承也符合源 button `text-on-primary`。因此粒子背景透明、shadow 使用源明确有效 `#D2F803`，底部 arrow 为 `#ffffff`，没有把不生效 token 修成 lime 实心。根代理已确认采用实际 PNG 和有效 CSS 的这一处理。

## 3. 保留的行为与字节边界

- create.js 只两处：正常 `draft = inset + 34 → +40`；异常 fallback `draft '146px' → '152px'`。profile、API、身份、安全状态、请求 generation/stale/超时、字段、保存/发布/最终确认、重大变更和所有业务字节均未编辑。
- 撤销这两处后原 JS 39839 B **逐字节相同**，SHA256 `23257bc0590551c7c507f0bc83fa73881051cb8e8a415e8bb7600bfef7ca8118`。
- helper 由 FORM 共用，所以 FORM 草稿 pill 也右间距增加6 px；这是批准的几何差异，不能称该位置完全未改变。IDEA 的 glyph 和全部新样式由 `.stage-IDEA` 限定；FORM/REVIEW header保留原字符/CSS人形分支。
- WXML 从原 FORM 开头到最后 REVIEW／重大变更确认区域 **逐字节相同**，SHA256 `ae0d41396fcec9f64b3eec6c7ab235b6c6aa395a90991ddb71f6849ff1ad1483`。
- 全页 95 个事件绑定、178 对事件/data/disabled/value/maxlength/checked属性按原序列 **完全相同**。原真实 value、index、disabled、身份和任何写入绑定没有增加假结果。
- 原 CSS 19819 B 整段作为字节相同前缀保留；新样式所有 selector 均 `.stage-IDEA` 起头，三个 keyframes 唯一命名，仅由该 scope 使用。既有 FORM/REVIEW/修改确认/快捷日期/费用/保存/发布 CSS 未重写。
- 未开放咖啡、小酒局由原 `available === false` 展示未开放并阻止填入。没有导入原示例“64”或源 JS 1200 ms 假生成成功，也没有更换第二批为不可支持类别。

## 4. 本轮唯一必要检查

在所有应用改动后一次执行资源/来源/绑定/保护区域静态检查，以及一次最小 helper VM（三分支），均 PASS。不是全量测试，没有 CI，没有视觉镜像测试或重复业务矩阵。

| 分支 | 输出 | 几何结论 |
| --- | --- | --- |
| 375 px window、capsule left278 | profile105px / draft145px | profile右缘270 = capsule left−8，原32头像与draft之间8px。 |
| invalid rect left999 | profile112px / draft152px | fallback仍保留32头像与8px间隔。 |
| API抛错的旧客户端 | profile112px / draft152px | 同fallback，未把异常转成假有效rect。 |

检查还确认10个 image本地引用全部存在、SVG合法、root/viewBox和全部child原路径不变、源SHA/输出SHA/许可字节一致；整个业务JS还原、FORM/REVIEW字节和CSS边界均按上述证据成立。

资源检查时来源清单仍在assets，原输出净增20168 B；根代理随后要求只移动无运行引用的证据清单到docs。`rg`确认miniprogram没有任何清单运行引用，移动前后SHA256相同：`9619d6df4e2c5480ce1ea148a3a18755cdb5322bb552cacae5759d922166824f`。应用没有再次改动；未重复几何或业务检查，最终包预算扣除清单5672 B。

原始本机输出留在独占 `/private/tmp/caper-wave66-create/resource-binding-check.json` 与 `geometry-vm.json`；不是代码库产品文件。根代理后续独立 review、WeChat compile、受影响交互走查与真实包预算仍需要完成；本报告不声称这些已通过。

### 独立 review 后的四处源 CSS 纠正

跨代理复核指出4个明确源差异，实施 owner 已重新读取原 HTML 核实并仅改以下 scoped CSS：

- source主题 `party-pink-soft` 为 `#FFF0F3`，POPULAR 和第三灵感图形盒由 `#fff0f4` 各改为 `#fff0f3`。
- orb tag 的 `font-label-sm` 只是 family token，配 `text-[10px]`，没有 `text-label-sm`；使用原默认1.5行高，因此14→15 px。
- quote 同样只是 family token配 `text-[12px]`，没有 `text-label-sm`；默认1.5行高，因此14→18 px。

只变上述4条IDEA规则的4个属性，CSS字节数不变，其余应用与素材均未改。来源复读后确认了最小替换；没有重复已经通过的95bindings、FORM/REVIEW保护或3分支几何检查。修正后的WXSS SHA256为 `4a23898ee332fcefc018093d54ac7d8a986b66404f5a3e75a23445b60760c5cd`，旧freeze为 `c0ea94991a497e717e599972c3ff5a0ae56501f01f0f7dc9a66b8220f30621ff`；产品净增仍14496 B。

## 5. 页内资产与冻结 hash

| SVG | 原 glyph | 有效原颜色 | B | SHA256 |
| --- | --- | --- | --- | --- |
| `auto-awesome.svg` | `auto_awesome` | `#5856d6` | 336 | `8bebe3d73f260df60152ac08254878e45434aa5bf19a85066314243d6931e48a` |
| `back.svg` | `arrow_back_ios_new` | `#1a1b1f` | 173 | `b4d72b3ef91399480f63d49489df5b8ff1b26436974b423b3c60d11b103ff854` |
| `cached.svg` | `cached` | `#1d64f2` | 403 | `7ac5b0ddbd174d47e5c08ce226710fab8cfa4d91257a4f2daec9f024ceaab548` |
| `drafts.svg` | `drafts` | `#1d64f2` | 333 | `d78b8ab8a83d7e9320b4318429bd3aaaf589b70e519b509095650c85ff89cc2d` |
| `forward.svg` | `arrow_forward_ios` | `#c3c6d8` | 172 | `e49d765d5b2fde4dd058fd2b06de021458762e09cac1de54a3f382e312c97055` |
| `generate-arrow.svg` | `arrow_back_ios_new` | `#ffffff` | 173 | `8d7cc9cb105207f6b369c2b433b8d8a22f4a1489d3c4241c5dcba59c9620bded` |
| `hero-arrow.svg` | `arrow_back_ios_new` | `#ff2d55` | 173 | `baddd81b5d29fb371c0bc9f91597cf8a6ae02ce8e9d9f58bdd70fdc059170f16` |
| `person.svg` | `person` | `#ffffff` | 544 | `d66a89fc9036f18a31f3804ee7b19f52a7954e31cc1cbfbd9b98f206a8299d6f` |
| `send.svg` | `send` | `#ffffff` | 211 | `03f4985351810fe35b60584b56dd68a057f7ab9f915003da416ae58ed4e0012a` |
| `trending-flat.svg` | `trending_flat` | `#424655` | 183 | `09abbcc6a1b69971a9daad2c11bb48baabeacdc22e454cfa4511d17bd90bbeb1` |

10个 SVG 合计2701 B。来源清单5672 B已从app移动到docs，不进入主包；清单保留每项官方固定 URL 和源 hash；全部 FILL=0，无路径重画或字体替代。

| 产品文件 | B | ΔB | SHA256 |
| --- | --- | --- | --- |
| `create.js` | 39839 | +0 | `ed71d3750551182c6676c8c71e204f1396343d5f5eb46a84f6fde1ff0847d4ef` |
| `create.wxml` | 29086 | +1686 | `b5d424441a75206f0d71e5f4b6d7cc0a82cbc1aef4aa4091293a61dbcb120131` |
| `create.wxss` | 29928 | +10109 | `4a23898ee332fcefc018093d54ac7d8a986b66404f5a3e75a23445b60760c5cd` |

产品净增 **14496 B** = SVG2701 + WXML1686 + WXSS10109；JS净增0，docs来源清单5672 B不进入主包。基于根代理提供的Wave65实际主包2046014 B，只加本页的原始源码算术为2060510 B，剩36642 B；**不是本批最终编译包体**。并发其他页新增和编译压缩会改变结果，正式判断归根代理的真实preview/main-package检查，不放宽2MiB门槛。

冻结后的确切自有路径/hash保存在 `/private/tmp/caper-wave66-create/frozen-owned-hashes.json`；原 protected snapshots仍在此目录。未改 Wave65 字体、其他页面、总验收矩阵或业务实现。
