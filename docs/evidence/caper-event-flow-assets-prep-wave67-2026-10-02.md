# Wave 67 — 报名确认／成功资产与字体准备

日期：2026-10-02。状态：**已完成来源准备；本报告创建时产品未修改。实施另记，不代表运行或正式验收。**

## 范围和原件

完整读取 ZIP 相等的 `pg05/code.html`、`pg05/screen.png` 与 `pg05_s/code.html`、`pg05_s/screen.png`。ZIP 为用户原始 `stitch_design_system_generator (2).zip`，24,668,856 B，SHA256 `df22e733d33fda20979b75b8a7bc94717c4a5c9e41561a54e3038432fab32603`。五 Tab／FORM 另有 owner；这里只准备活动确认和真正 JOINED 的图形。

| 原件 | Bytes | SHA256 |
|---|---:|---|
| pg05 HTML | 17,811 | `a016c7725aebb5eeb0ceaad0664651f723a78459738b049fc4c51fa652ac0075` |
| pg05 PNG，647×1600 | 386,681 | `96167d34204721512ade34dedf01313894b09b68147865b5a104015a3679d63b` |
| pg05_s HTML | 26,407 | `cc462e2d55b767cac1abae42cae61ff796dafbdb265941538d908f9d39dafd27` |
| pg05_s PNG，412×1600 | 295,313 | `01517b01a2b6438d4851f70ce262c54a05ecba9da04cf051ae643cbb50667136` |

临时目录 `/private/tmp/caper-wave67-event-prep/`；完整 `manifest.json` 30,986 B，SHA256 `ca036c357b0b69533607d86ddcce39a9bcd8f2b6a7cb57b84781ef1c484a6efd`，包含 CSS2 URLs、返回字体 URL、原节点 opening、SVG path 子树、axes、字体 cmap/version、许可与 baseline hash。未复制照片；成功原稿三个示例头像不用于产品。没有字体放入 event/assets。

## pg05 原 inline SVG

原 12 个 SVG 均已有 viewBox；其中两枚假状态栏不导出，10 次业务区域出现归并为 8 个原树。standalone root 只补原 class 派生尺寸、继承颜色、stroke-width、标准 xmlns；子节点 tag/attrs 与原片段逐一相等。2,532 B。

| 资源 | 原行 | px | 继承色 | Bytes | SHA256 |
|---|---:|---:|---|---:|---|
| `pg05-back.svg` | 96 | 24 | `#18181B` | 220 | `fcf8e9658cab1dac7d3657febcd4ccf24a4a290efeeb004726f3b89def48d500` |
| `pg05-more.svg` | 104 | 24 | `#18181B` | 225 | `ded6ef6e4079cbd7274213090123ddaa306e3ce5ac1dcc59192b3257d388c9bd` |
| `pg05-shuttle.svg` | 139 | 44 | `#FDE047` | 289 | `232a17d687332ed81598b838830e832b1a728135a4b3c7f3fbb5ae52959479c7` |
| `pg05-calendar.svg` | 178 | 16 | `#A1A1AA` | 428 | `e68bfb3ca725914459622892b17cdc972e7fc7de0ef861287dc76862982be16c` |
| `pg05-pin.svg` | 188 | 16 | `#A1A1AA` | 400 | `b478e0e270310d7a33f39cf3619037e02e7b70271b0e5d8c75056a479211e818` |
| `pg05-groups.svg` | 197 | 16 | `#A1A1AA` | 465 | `4d7144e0988be8fe478016e6d4ad0fe9f8db37a72cec66e2f766a7e2109d6f98` |
| `pg05-money.svg` | 213 | 16 | `#A1A1AA` | 288 | `ac02d8c16cd928eb40ff133cdfeb116e0997b054fa8450c4e40a79e98229c2d7` |
| `pg05-check.svg` | 224 | 10 | `#FFFFFF` | 217 | `1356bf136e677aa7a9c4ec8dd75fbeb94651f263550a52722a6f49127f154bd5` |

`pg05-shuttle` 44px、viewBox `0 0 64 64`：root yellow300，内部 path white/0.9、circle `#FACC15`；不是换画羽毛球。`money` 原 d 是 `M12 7v10M9 9h6a2 2 0 010 4H9`，不误复用 PG01 的不同货币 glyph。选中 check 与规则 check 同一原 10px/stroke3，三个来源出现 geometry 相等。

pg04 有 10 个缺失 viewBox 的 SVG（原行 91/132/153/175/192/210/244/261/278/316）；本任务不导出或补猜。pg05_s 没有 inline SVG。

## pg05_s 官方固定 Material Symbols

官方固定仓库 commit `bd8cb85bd4bad964fe6918f79665bb40c3a8efef`，路径 `symbols/web/<symbol>/materialsymbolsoutlined/<symbol>_24px.svg`；check 使用 `check_fill1_24px.svg`。全部 **outlined、wght400、opsz24、GRAD0；check FILL1，其余 FILL0**。源 display42/130 等仅显示尺寸，不改 opsz。官方根 viewBox/path/root dimensions 保留，export 仅补根 fill/标准 xmlns；没有 Material 字体进入小程序。官方来源：[Material Symbols 仓库](https://github.com/google/material-design-icons/tree/bd8cb85bd4bad964fe6918f79665bb40c3a8efef/symbols/web)。

| symbol | 原行 | display px | 原有效色 | FILL | Bytes | 官方 SVG SHA256 |
|---|---:|---:|---|---:|---:|---|
| `arrow_back_ios_new` | 9 | 24 | `#1A1B1F` | 0 | 173 | `24883e73bfab266fa35e91ae4f014c72ad858c4d7ab0ee51a9a171616dacd43f` |
| `person` | 9 | 18 | `#FFFFFF` | 0 | 544 | `42f1c6f70aaea6be1bce078d1bd3bdc027a343943827443fe3ea46320b9dac96` |
| `check` | 21 | 42 | `#FFFFFF` | 1 | 174 | `01edd53418816632be08e9565b8ca40d9028c230a8a67baaf4b8a1de20db00e6` |
| `sports_tennis` | 46 | 130 | `#FFFFFF` | 0 | 574 | `9c1bda7a51f6f7bbc608d646a054ca6ee81472daac6d277d96ce5333d3d5b449` |
| `calendar_today` | 79 | 20 | `#004CC8` | 0 | 321 | `ed114259f3b2bd3023f6bc73e8ed288d3825a0ebc22ca930e201dbc1fc85337e` |
| `edit_calendar` | 87 | 16 | `#004CC8` | 0 | 502 | `7e55b58b959532f43d009580a85e1da8cbcc5ba130322c94354e1ba99456370e` |
| `location_on` | 95 | 20 | `#FF2D55` | 0 | 441 | `d5b06c1bf2c7901c208bcfd22b31175478afe78d2a789c2f1fe102c238fd5b4e` |
| `navigation` | 104 | 16 | `#1A1B1F` | 0 | 220 | `5a3e8027b9765ebdc3bf4fefbe03a051b7c306d90d8f596e03311174ce8a8665` |
| `payments` | 111 | 20 | `#647700` | 0 | 510 | `12a6063fdb110a2899caea4c3857ad37e18788e57a5e0a0c7dd7f43f0d0df5b6` |
| `qr_code_2` | 124 | 36 | `#004CC8` | 0 | 633 | `6beca0bda8c86f1ded326a4f87fdf1c34aa3bc4908a3f18bf90533c81598204e` |
| `forum` | 147 | 18 | `#34C759` | 0 | 353 | `08c85b119250ffc7c094b6f31ea43eb362f2e83bca432f6a928bc34499f66938` |
| `groups` | 161 | 20 | `#FFFFFF` | 0 | 827 | `6b4d11047122bc3fb3ba8224281c6a7c9a751d9b8607e84542f9163a14dbfe67` |
| `content_copy` | 166 | 16 | `#424655` | 0 | 336 | `3575c3fdb035a66097bed9a7597620e313ed1efa051eb586a7335348c3fdff35` |
| `group` | 177 | 20 | `#004CC8` | 0 | 762 | `031fc5c789411892258f9018d71785d5144b18e25aadc147388ecb9ceccc3412` |
| `chevron_right` | 182 | 16 | `#004CC8` | 0 | 174 | `f6b777ee0ce9059b5f8eea987d813ab12c4f309ba431063153841c742e668ac0` |
| `person_add` | 224 | 16 | `#FF2D55` | 0 | 599 | `d78f38d029ffdce1301912eddc54753ac5d8d34bba2e452b6a0c03d51ad73901` |
| `verified_user` | 235 | 18 | `#004CC8` | 0 | 337 | `abd70cab16bbd9d08b455421d32d7fbb6aa5b24c87403ce0dd333109db313752` |
| `arrow_forward` | 255 | 18 | `#FFFFFF` | 0 | 186 | `717c65e2e704a07b7b73e194b202858f52befbaa6dd363565a1d75d117c3a2aa` |
| `ios_share` | 259 | 22 | `#181E00` | 0 | 333 | `a3709b2a5ee59f4d7614828ce631baece0c4314639bcbc4bf8e56066b89ee070` |
| `check_circle` | 265 | 18 | `#D2F803` | 0 | 459 | `42bf0950bc12ecf7952a8c3be86e0131f225095a7dc6c824a659a13df442e373` |

20 个源变体共 8,458 B。`qr_code_2`、`groups`、`content_copy`、`person_add`、`check_circle` 只证明原稿，不能据此增加固定票码、微信群、微信号、虚构余席、toast 假成功；实际产品所需集合由实施绑定决定。原 `navigation` 的按钮 script 实际 copyAddress，产品若保留该 glyph 必须显式标为“复制地点”并用原 copyJoinedVenue。已有 `/pages/create/assets/back.svg` 与 `person.svg` 官方 path、颜色与源准确相等，可原路径复用，避免重复资源。所有已有原 JPEG 可复用，不新增照片。

**纠正 Wave66 只读 gap audit 的一处颜色推断**：pg05_s:182 的 `chevron_right` 继承父级 `text-primary`，实际 `#004CC8`，不是 `#424655`；此报告以完整原节点为准，旧冻结 audit 未改。

## 字体准确来源和最小接入方案

原 pg05:55 import Caveat700、Permanent Marker400、Rubik Mono One400。实际有节点的是 Rubik 标题和 Caveat 注释；`.font-marker` 无任何应用节点，Permanent Marker 不新增。Rubik 原唯一面为 normal400，原 heading `.italic` 是浏览器合成倾斜，不能擅改成 900／独立 italic 面。pg05:127 的 Good People / Great Rallies 可见；:236 Same Game, New Friends 是 `hidden sm:block`，max425 不触发 sm，不计入新可见字符。

官方 Google Fonts 仓库 fixed commit `9710da1eacb3be272583c3224dcb70f9da6eadbb` 保存 Rubik / Caveat METADATA.pb 与 OFL 原文；CSS2 由官方服务器返回 static WOFF bytes，URL/hash/UA 保存在 manifest，**不声称 generated subset 是仓库 blob，不做本地字体重绘或子集**。来源：[Rubik 元数据](https://github.com/google/fonts/blob/9710da1eacb3be272583c3224dcb70f9da6eadbb/ofl/rubikmonoone/METADATA.pb)、[Rubik OFL](https://github.com/google/fonts/blob/9710da1eacb3be272583c3224dcb70f9da6eadbb/ofl/rubikmonoone/OFL.txt)、[Caveat OFL](https://github.com/google/fonts/blob/9710da1eacb3be272583c3224dcb70f9da6eadbb/ofl/caveat/OFL.txt)。

| 官方返回候选 | WOFF B | Base64 B | OS/2 weight | version | SHA256 |
|---|---:|---:|---:|---|---|
| `rubik-mono-one-400-pg05` | 4040 | 5388 | 400 | Version 1.001 | `36faf220f9935cff89be4b5611a337202dc2a95be07df3565594ce6208c4285a` |
| `caveat-700-pg05` | 9204 | 12272 | 700 | Version 2.000 | `a3a6819094fd153fe56a566d4b2ee8016a18b84df01b44686ae72ee59208d55c` |
| `caveat-700-home-pg05-union` | 19336 | 25784 | 700 | Version 2.000 | `e587efbee29f5e2239cf3b1e9fc63eaf71e200607b9b84c70226913bddc6cb03` |

- Rubik 文本 `BADMINTON TOGETHER`，14 glyph / 13 unicode，static400/no axes。tmp `fonts/rubik-mono-one-400-pg05.woff` 可供 root 独占 loader 接入。
- Caveat 新文本 `Good People Great Rallies`，仅新 face 9,204 B；与旧 face 再加同 family/weight 会依赖 native 同名 face 合并行为，故最小明确方案为**替换现有700 face 为旧首页＋新可见文本 union**，19,336 B。旧18,280 B，Base64 24,376→25,784，净1,408 B；新 Rubik Base645,388，总**净6,796 B**，另算描述和许可导出。
- Union 文本 `More People, Brighter Days Same Game & New Friends Good People Great Rallies`，79 glyph / 28 unicode、static700/no axes、Version2.000。旧 cmap27字符全覆盖、unitsPerEm相等，SVGPathPen逐旧字符 outlinecommands完全相等。新文本只有大写 R 是旧 face 未覆盖字符，替换不会改动旧首页27字符轮廓。
- Rubik OFL原文4,462 B SHA256 `43d530580461a574f6dfed9e15af6a74e95f7c04d9bfa1174a63ff036e8eee07`；Caveat OFL4,385 B SHA256 `1f9d81d094273d82f3898a1ee8b598a717d050ecbf5ff7bede105b704880157b`；Material Apache11,357 B SHA256 `58d1e17ffe5109a7ae296caafcadfdbe6a7d176f0bc4ab01e12a689b0499d8bd`。原文只读保存 tmp/许可证，未改共享版权页。

**纠正另一处“缺500face”推断**：pg05_s import Jakarta400/600/700/800，源 fee 节点 `font-medium` 的 CSS500在400–500缺面匹配算法下先选400，而非先600。保留 CSS500语义与原四个官方面即可；不自动新增500face。Caveat未显式权重的注释继承CSS400，但原只import700，因此唯一700面匹配；原 computed CSS400，仅700面实际匹配；native 接入经 root 要求显式声明700，保证相同官方唯一面选择。依据：[W3C CSS Fonts 4 font matching](https://www.w3.org/TR/css-fonts-4/#font-style-matching)。

全局 reference-fonts.js / reference-font-data.js、字体 docs、字体版权计数由 root 独占；event CSS 仅声明准确 family，实际字体加载／用户界面验收交 root。原 H3 9项为5依赖＋2图标＋2字体，新增 Rubik 若实际接入将成为3字体，root 应同步真实卡片／计数。此报告不代表39屏全字体已完成。

## 原 token 与 native 适配边界

pg05 source poster `aspect-[4/3.3]`、p20/r16；headline26/1.05、Rubik、yellow400／-2°／scaleY1.05；Caveat11/+3°。源44px header、36px hit、24px glyph，与真实 statusBarHeight / capsule 保留的 headerPaddingRight 合成，不复制两层假 status／home indicator。源 `shadow-xs` / `backdrop-blur-xs` 未定义，不能猜值。pg05 footer px16/pt12/gap12、cancel96/py12/r12/font12；底部实际 safe替代原模拟34px／homebar。

pg05_s source body15/21/400，header56px、back44/profile32/glyph24/18；hero check80/glyph42，badge11±12°；ticket112px、tennis130/opacity.2；core20px左右／icon36/20，社区16px，授权昵称4列/gap10/avatar44，取消规则14px，footer48px/15/20。所有原px保持字面值；真实中文长文本及真实规则自然扩展高度，无固定假席位/人名/头像/地图/个人主页。

原随机 confetti38 pieces/180frames是短暂JS动画，最终原PNG已消失；不增加随机脚本/假业务toast。准备阶段没有应用、微信、Git、验收矩阵变更，没有执行全量或业务测试。
