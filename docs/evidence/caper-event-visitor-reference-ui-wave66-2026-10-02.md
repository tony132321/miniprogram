# Wave66 PG01 普通羽毛球访客原稿恢复

日期：2026-10-02。按已批准的 `2026-10-02-messages-idea-visitor-reference-ui.md` 执行任务 C。源码/资源限定检查通过，产品文件冻结。本报告未操作微信、Git、总矩阵、全量/CI或Wave65文件。实际微信渲染、胶囊/底栏、包体由root同步后有限验收；不等于39屏或真机完成。

## 范围与保护

新增范围严格为 `loadState === 'READY' && activeSection === 'detailsSection' && !successState && display.isBadminton && !isHost && myRegistration.status !== 'CONFIRMED' && !joinConfirmation`。新nav、poster、sheet、footer及page class均用该同一条件；旧topbar/poster/details/footer用反条件保留。确认打开时新层不呈现，原确认z30高于原header12/footer6；generic、主办、已确认成员、success和其他section走原完整分支。

去除四个新块/反条件/page class后，原WXML **逐字节恢复**，527条原contract属性保持，SHA-256 `92da3fc366ce0b32863cfb82f2ae1e310482e27ca168a2db21bdc2e33f51c276`。旧WXSS是最终完整未改前缀 `426a994e9c6538aa99685d0bf060616bbeef29fe16dc4b2c93a284305ebbc008`。所有追加选择器只在pg01-visitor或新pg01-visitor-nav下，无全局poster/detail-section或其他section修改。

新访客层保留实际display/event/hostAlias/memberCards、费用及当前统计；仍显示原授权昵称、审批、预留/候补/重新确认、时间/场地声明、取消规则、审核版本、成局风险/暂停、紧急危险、举报/可信任人复制等真实说明。主办头像仍匿名星号占位，未导入Léo、16人、原示例人物照片或假地图。全部新binding仍调用既有 copySafetyDetails, copyVenue, goBack, goToReport, jumpToSection, openEventActions, openJoinConfirmation, shareCurrentEvent；joinButton原安全/资格/招募/risk/status条件原文保持，未满足时仍原“查看报名与成员”入口。没有改变报名确认/审核/身份或其他业务。

## 原稿与图形

完整原HTML/PNG：`/private/tmp/irl-stitch-original/stitch_design_system_generator/pg01/`。HTML SHA-256 `ae12d6f11a51ffaccae03ae8b27f02144ee6f4c00a072e75edb933ff1aea88c4`，PNG SHA-256 `33cd936b61a39af9f4d18220897ee48283de72153bf6e286d478147eda0b52a2`。新增 **14 SVG / 4228B**，12原inline配色/几何变体＋2 Material outlines。完整源行/opening/source hash/child hash/root色/许可在独立 `docs/evidence/caper-event-visitor-reference-sources-wave66-2026-10-02.json`，不装入主包。

原15 inline包含模拟status两图，未复制这些系统图形。源行：轨迹126、球拍133、皇冠146、back210、share217/378、more222、chevron284/308、heart318、money328、groups338、seat-chevron354。全部children逐字节原稿一致；只根加xmlns、移除网页class/id、解析currentColor。track根补源CSS opacity0.4；racket根stroke白20%而子line #D2F803独立保留。source transform/几何：track400×480 viewBox铺满；racket192×288/right12/top40/-12°；crown32/top64/left24/-12°；back20/-2px平移，share16，more20；venue/host chevron14/16相同stroke2.2，seat-chevron16独立stroke2，meta16。

calendar_today/location_on重新取自官方固定Google Material commit `bd8cb85bd4bad964fe6918f79665bb40c3a8efef` 的outlined SVG，hash匹配已留存share sourceSha；opsz24/wght400/FILL0/GRAD0。仅根fill改为源gray800 #1F2937，path/children不变。Apache-2.0原文 `docs/licenses/material-symbols-Apache-2.0.txt`；未混入Phosphor/FILL1或字体。原inline是用户提供参考图形，未另造上游许可证。

照片仅引用现有 `/assets/stitch/pg01_badminton_player.jpg`：36028B、512×279、SHA-256 `9d3ffba93e70736ff1d8d72c3f8387e2a7f3e4fafca6c0a9f56b1be2fb03db88` 完全不变。原h-84未定义；采用widthFix/width256/top48/right-24/-3°，留存图自然高度139.5，未猜336或复制照片。未重新获取原远程照片，故不据文件名称其像素与远程原图完全相同，也不称其本场真实参与者。

## 恢复token与真实功能适配

- 海报width100%/max425/4:4.8，三色 #0A52DF→#026BFB→#00CEFE、18×18点阵与原两光层，原SVG轨迹/球拍；headline42/50、标题组-2.5°；白tag6×12/-1°；badge border2.5/p10×14/r16。原poster/hand family stack恢复，但不扩Wave65字体范围：PG01 900 italic及额外hand节点的确切face未在本轮新增，不能用family名称承诺精确font shape已验。
- native动作56px/status+56，左16、圆36/右gap8，dark glass38%/border20%；真实capsule右留至少8px，不复制模拟时钟/系统图标。
- sheet overlap24/r32/p20×20×32，title22/标题描述真实tags区pb20/border；facts40/r16/glyph20/gap14/rowgap16，地点max215。“复制地点”、实际时间/场地label与声明保留，没有“去导航”假能力。
- host p14/r16/avatar48/gradient halo2、真实授权昵称；source meta紧凑两列与heart/money/groups16、seat层级恢复，取消/人数细项与必要审核安全说明完整显示。未创建成员头像stack或个人主页。
- 底部fixed/max425，p横20/上14/下32+safe/gap12；join py14/px24/font15，复制 py14/px20/glyph16。真实6字“复制活动信息”和aria label保持，窄屏该副button文本容器ellipsis，未整体缩小字级或padding。

## event.js 最小几何差异

root已授权只复制index.js现存headerPaddingRight helper，包括fallback112px；新增data.headerPaddingRight及现有onLoad setData的该字段。statusBarHeight算法、其他data/方法及业务完全不动。删除上述新增片段后精确恢复原event.js `511d72c878c18d391304523180ea6baae8151322bbc59a73490c0ba385b01a4d`。

## 限定验证

来源/资源/binding/保护区逻辑检查 **PASS**：14SVG XML与原children/hash、16静态refs、原JPEG、527原contract byte恢复、8新handlers均存在、原CSS前缀/JS恢复hash。检查端将WXML合法的无值wx:else转为空属性后做标准XML结构验证；这一归一化不改产品。新nav-actions亦明确限定到新nav。证据 `/private/tmp/caper-wave66-event-review/source-resource-protection-check.json`。

新增helper几何VM **7场景PASS**：320/375/390/425菜单rect，inset104/105/108/107px、capsule gap至少8px、36px三按钮＋8px右gap不重叠；另外三类缺API/异常/无效rect仍112px。海报384/450/468/510及照片139.5只是算术记录，不是微信渲染证据。未模拟或调用业务/登录/微信。证据 `/private/tmp/caper-wave66-event-review/header-geometry-check.json`。

主包原始文件净增 **29131B**；新SVG4228B，照片0B，manifest/evidence均在docs外置。净差不代替实际preview大小，root最终主包仍须<2MiB。没有运行全量/CI/镜像或任何新报名/发布/费用写入。

## 独立审查后的两处 CSS 订正

原 pg01:164 同时出现 `text-[15px] text-lg sm:text-xl`。Tailwind v3.4.17 官方 [候选 ASCII 排序](https://raw.githubusercontent.com/tailwindlabs/tailwindcss/v3.4.17/src/lib/expandTailwindAtRules.js) 原始文件163–169（web显示151–159）、[相同 utility 注册序稳定排序](https://raw.githubusercontent.com/tailwindlabs/tailwindcss/v3.4.17/src/lib/offsets.js) 原始文件276–277（web显示257–258），以及 [lg 默认字级](https://raw.githubusercontent.com/tailwindlabs/tailwindcss/v3.4.17/stubs/config.full.js) 328 支持 `text-lg` 后覆盖：18px/28px；425px 内不触发 sm。副标仅订正至18px/28px。复制原节点 `text-[14px]` 没有 leading override，继承默认1.5，故21px；仅将20px订正为21px。

官方源码只读保存于 `/private/tmp/caper-wave66-event-review/tailwind-3.4.17-source/`：expandTailwindAtRules.js SHA-256 `7a29e3b220512d09004d9cd6e92ccad3b3bd24a5d6b8ee9dd8b4203c9336bb3d`；offsets.js `0fd4868b2aef3415ea7c1ee8b91efbecc916a5afa2c7887be03ace0a415edd80`；config.full.js `8f3394e8a4990a7b678d3462b6e1440b84c11a6c06e55d7b26108b90a1fcc538`。逆向恢复这两处后 WXSS 完整旧冻结 hash 一致，证明只改这两处。WXML/JS/SVG/source manifest 不动；527 binding/7 VM/资源检查使用此前已过结果，没有重复运行。限定差异证明 `/private/tmp/caper-wave66-event-review/two-css-source-corrections.json`。

## 冻结身份

| 路径 | bytes | SHA-256 |
| --- | ---: | --- |
| `miniprogram/pages/event/event.wxml` | 87816 | `265efb383b028a8368166578b04f78f03493020180fdf2363b7aefbd33aaa744` |
| `miniprogram/pages/event/event.wxss` | 98830 | `72bd3f539753dc0c2bbb2da5dcce33fd1ee6514d0dcbe71f7ded3268e7b5f4f9` |
| `miniprogram/pages/event/event.js` | 104032 | `7aba63388c13daae75f2485cf31bea5ab0bd7db1a1568e293a03b31240fd7605` |
| `miniprogram/pages/event/assets/pg01-track.svg` | 341 | `37e07bb5f4c1ee571765c5452cb212b089fd08971931430d0f7f6f2ebf2ab861` |
| `miniprogram/pages/event/assets/pg01-racket.svg` | 501 | `ceae95cb399998f7cc4c96fa6a395716941790562cf79f1ba65577263da585bd` |
| `miniprogram/pages/event/assets/pg01-crown.svg` | 255 | `fb9f9b76aa3ca4e1786cc35b2dd0b172e6f501391cb5cb11a4955a9ecb21d28b` |
| `miniprogram/pages/event/assets/pg01-back.svg` | 197 | `936ba6e51e7ea41962e89cd2ed0f5607dad17f647d627f072a075ac2fca22c0e` |
| `miniprogram/pages/event/assets/pg01-share-white.svg` | 244 | `e8bb7afadf7fe8a663d6226140e2c8f1dbae5638bf88c640b302f60ce91941ae` |
| `miniprogram/pages/event/assets/pg01-more.svg` | 202 | `9620512c239026603281bb79f2de4e183065e223c2425cbd99fe08b572e19c3f` |
| `miniprogram/pages/event/assets/pg01-chevron.svg` | 194 | `fe8209a2c13213904b8d7b5f93b6eb0770b0f4bd6f8be28157596fcd02a33630` |
| `miniprogram/pages/event/assets/pg01-heart.svg` | 303 | `ee58caf97aa97c04358c66ff19147ea48b837b54d41dfbb8d50290bd917d9dc3` |
| `miniprogram/pages/event/assets/pg01-money.svg` | 351 | `c1d837d2b54155fb586cdc88446fab690c313f38f9b815f22ffc834724d4cefc` |
| `miniprogram/pages/event/assets/pg01-groups.svg` | 442 | `7389b1e9b5ae187e889de57ecb9681c0aed5ed4db3ce003f2f753eb5e857bcbd` |
| `miniprogram/pages/event/assets/pg01-seat-chevron.svg` | 192 | `34fa718a8348189039d09d4f0138353309b1cd6e8fde68451682dd16ccb744ee` |
| `miniprogram/pages/event/assets/pg01-share-dark.svg` | 244 | `46f9fecb2acd63c650e2f36ca1509deb662e6fda54ec53e4b7839f9a686ae122` |
| `miniprogram/pages/event/assets/pg01-calendar_today.svg` | 321 | `0eb35d52aa070a121f66242fb5dd7b2e0c402f5549b9737779bc8bb5a14f0aa3` |
| `miniprogram/pages/event/assets/pg01-location_on.svg` | 441 | `09861c3bd72a72b766f76e539f03e19740a4a0591d68ebfa528a7fc94fbf6be2` |
| `docs/evidence/caper-event-visitor-reference-sources-wave66-2026-10-02.json` | 12321 | `5e4eb9c0711e990719fd8b6e6c5c566d51dc913a14c858f8909c84e7f65041ee` |
