# Wave 67 — 羽毛球报名确认与真实报名成功原稿实施

日期：2026-10-02。**本代理产品已冻结；完成来源／静态保护检查，尚不代表原生运行或业务成功验收。**

依据已批准计划 `docs/superpowers/plans/2026-10-02-tab-form-registration-reference-ui.md` 与 parent 对 event 独占实施的明确授权；基线 Wave66 `a8486175a3bfb3a70f475725b4901d1cf9de603b`。没有 Git／微信／CLI／SDK／全量／CI 操作，没有总矩阵变更。其他页面、全局字体、分包迁移均由其 owner 独占。

## 实施范围

- 新 pg05 分支仅 `loadState === 'READY' && joinConfirmation && joinConfirmation.isBadminton`。旧确认分支只排除此准确 predicate，原内部 markup 保留。JOIN/INTERESTED、canExpressInterest、joinSubmitting／disabled、版本、真实活动标题／时间／地点／人数／费用／水平／审核与取消规则、关闭留言声明及风险文案全部保留。
- 新 pg05_s 分支仅 `loadState === 'READY' && successState === 'JOINED' && display.isBadminton && myRegistration.status === 'CONFIRMED'`。既有 JS 唯有服务端回读 CONFIRMED 后设置 JOINED；本次不加任何状态注入。旧 JOINED 分支仅排除此 predicate，保留 generic 原结构；PUBLISHED、Wave66 PG01、host/member/其他 sections 字节保护见下。
- 新成功页沿用 goBack／jumpToSection／addJoinedCalendar／copyJoinedVenue／goToItinerary／viewSuccessDetails／shareCurrentEvent 的真实绑定。source navigation 图形使用现有 clipboard 方法，明确按钮“复制地点”；头像形 header 明确“查看报名与成员”，不新建地图或个人主页。公告仍到真实 contentSection，昵称仅既有 memberCards授权数据。
- `event.js` **104,032 B 完全未改**，没有新 helper/data/onLoad，也没有业务／身份／资格／版本／接口／依赖路径修改。真实 statusBarHeight 与 Wave66已存在 headerPaddingRight复用。最终完整 event 移入 activity 由 root 冻结后单独实施，当前 proof 仍以旧 `/pages/event/event` 路径为准。

## 原稿角色与准确样式

| 区域 | 原来源与本次样式 |
|---|---|
| pg05 header | 原44px、hit36、glyph24；真实 status/capsule inset，font16/24/700 |
| pg05海报 | width100%、aspect4/3.3、p20/r16、0062FF→0052FF→0142C8；原192/176 glow、96圆盘／36emoji、44原shuttle、yellow400标题26/1.05／-2°／scaleY1.05 |
| 海报字体 | Rubik Mono One normal400＋原 CSSitalic 合成；Caveat11/16.5，explicit700选择原唯一官方面；CAPER STYLE沿用本产品既有品牌文案，原示意Partiful文案未引入 |
| pg05真实活动卡 | mt16/p16/r16；原 title18/24.75/700、sport tag12、fact13/19.5／gray icon16；新增布局保持原真实版本／时间补充声明；规则blue notice11/13.75显示真实审核和取消规则 |
| 参与选择 | mt20、label12、两列gap10/p14/r12、selected border2/16radio/check10stroke3；INTERESTED仍不占名额、不进候补。真实仅一个选项时只占完整列 |
| pg05footer | 原px16/pt12/gap12、cancel96、py12/r12/font12；真实safe与最低12；原footer `backdrop-blur-md`=12px，原圆盘无效 `backdrop-blur-xs` 未猜值 |
| pg05_s header | source56px/back44/glyph24；profile完整44触区包内32bluecircle/person18。标题17/22/600、bodyJakarta15/21/400；真实status/capsule inset |
| 成功hero | sourcecheck80、官方check FILL1 display42；绿色34C759、11/14 stickers±12°，headline22/28/700；文案仍“已确认席位”真实回读限定 |
| 活动卡 | source112px作为minimum以容纳真实长标题；tennis130/white/opacity.2、16pxnotch row／24cutouts／原dash；core20px、icons36／glyph20、labels11/14/700／values17/22/600，fee15/21/CSS500 |
| 公告／昵称／规则 | sourceforum18/green28、17/22/700标题（:149原有font-bold，经review疑点回读确认）；公告16px/greenCTA15/20；四列昵称gap10/p8/avatar44/name11，仅真实glyph与授权昵称；取消规则p14/icon28/18/body13/17.875显示真实文案 |
| footer／ambient | source48pxbuttons/gap12/flex1:1.5/share48、arrow18/share22、15/20/600；source256/224/192 glow blur64/64/40，source -48/192/384 offsets在真实status＋56之后定位；bottom actualsafe替代假homebar |

全部新增CSS仅165个新scope selectors：`.pg05-reference ...`、`.pg05s-native-* ...`、`.event-page.pg05s-reference`、`.pg05s-reference ...`。旧CSS98,830 B前缀完全未改。Source `shadow-xs`／`backdrop-blur-xs`不定义，不增加猜测；Material opsz保持24，即使display42／130。源RGB/alpha/roles/source-node/axes/path完整记入来源JSON。

原随机38piece/180frames confetti与prototype toast为短暂原稿脚本，最终源PNG未显示；本次复原稳态，不加该JS。没有把示意照片、固定昵称、票码、微信群、余席或“免费取消／转让”承诺接入真实业务。真实动态签到入口保留，64px位置为现有“查看签到”按钮，不显示模拟QR或电子PASS。

## 官方图形与字体边界

完整来源准备见 `docs/evidence/caper-event-flow-assets-prep-wave67-2026-10-02.md`。pg05八枚原 inline2532 B；pg05_s13枚必要官方 fixed outlined变体4887 B，合计**21个新增SVG／7,419 B**。无整图标字体、JPEG、照片或重复字节资源新增；header back/person精确复用已有 `/pages/create/assets/back.svg`、`person.svg`（path/色与固定官方源相等）。

Material fixedcommit `bd8cb85bd4bad964fe6918f79665bb40c3a8efef`，所有opsz24/wght400/GRAD0；checkFILL1，其余FILL0。原inline子树逐节点完全相等，Material只补computed fill及标准xmlns。pg05全部12原SVG已有viewBox，pg05_s无inline；未触碰其他页缺失viewBox。chevron_right继承原parentprimary准确`#004CC8`，纠正旧冻结gap audit颜色推断，未修改旧证据。

全局官方字体由root独占且另审：本页面CSS只声明准确family。Rubik400官方WOFF4,040 B、Caveat700union19,336 B（原27unicode outline保留／新增大写R），两者Base64相对旧净增6,796 B；资源与OFL原文在prep。原Jakarta400/600/700/800保持；原font-medium CSS500缺面按W3C匹配400，不能将原缺500误判成新500font必要。PermanentMarker虽import但没有usednode，本页不新增。原native字体是否实际显示／加载不在本代理证据中。

## 一次必要保护／资源检查

脚本 `/private/tmp/caper-wave67-event-prep/check_event.py`、结果 `/private/tmp/caper-wave67-event-prep/limited-check.json` SHA256 `4580b768d5050285ceb180768c475a3c652df1eebd9047e53b135dcfac134d6c`。首次解析器遗漏合法WXML bare `wx:else` 的XML规范化，在未改generic原第28行报ParseError；仅修正验证器规范化后完成本次限定检查，产品未因此修改，记录 `failed-check-1.txt`。没有重跑Wave66 527bindings／7VM或完整业务测试。

- 四个完整源HTML/PNG与原ZIP字节相等，hash与prep记录一致。
- WXML在仅规范化 moustache／bare wx:else 后XML语法解析成功；43个静态图片引用全部存在。
- 4处可逆markup操作逐一逆还原，**整个原 WXML87,816 B 完全字节相等**：SHA256 `265efb383b028a8368166578b04f78f03493020180fdf2363b7aefbd33aaa744`。全部原内容／其他section／generic分支未改；加入新scope只改变互斥outerpredicate。
- 旧 literal binding160全部保留；新增17个真实handler binding在原未改JS存在。新确认及成功分支复制现有必要绑定，更多操作、native返回／成员入口复用现有handler，不新增伪功能。全字节逆还原同时覆盖所有旧规则、版本与绑定，而非仅计数。
- CSS全旧前缀98,830 B相等：SHA256 `72bd3f539753dc0c2bbb2da5dcce33fd1ee6514d0dcbe71f7ded3268e7b5f4f9`；全部新增scope selector和SVG根／子树／颜色有来源检查。
- event.js全字节相等：SHA256 `7aba63388c13daae75f2485cf31bea5ab0bd7db1a1568e293a03b31240fd7605`；没有必要新增VM，因为业务代码未变。
- PG01 nav／poster／sheet 与 PUBLISHED block另做原片段 hash相等；完整保护记录、逆还原操作和source roots在 `docs/evidence/caper-event-flow-assets-sources-wave67-2026-10-02.json`（SHA256 `1230a876f692f91f7f5891a2627c6d543fbaf2d3c12c0a76402518bb0e239787`）。

## 冻结文件与字节

| 产品文件 | Bytes | SHA256 |
|---|---:|---|
| `miniprogram/pages/event/event.wxml` | 100,072 | `c2dd55c68a3123d9969c204df0d1e91ccca69e53dda4ae5c921a12041eeb9720` |
| `miniprogram/pages/event/event.wxss` | 120,006 | `94049293bebaf3889760403fb43de4b0a3710f82de40d3d0655e54ef5074e6af` |
| `miniprogram/pages/event/event.js` | 104,032 | `7aba63388c13daae75f2485cf31bea5ab0bd7db1a1568e293a03b31240fd7605` |

| 新SVG文件（均在miniprogram/pages/event/assets） | Bytes | SHA256 |
|---|---:|---|
| `pg05-back.svg` | 220 | `fcf8e9658cab1dac7d3657febcd4ccf24a4a290efeeb004726f3b89def48d500` |
| `pg05-calendar.svg` | 428 | `e68bfb3ca725914459622892b17cdc972e7fc7de0ef861287dc76862982be16c` |
| `pg05-check.svg` | 217 | `1356bf136e677aa7a9c4ec8dd75fbeb94651f263550a52722a6f49127f154bd5` |
| `pg05-groups.svg` | 465 | `4d7144e0988be8fe478016e6d4ad0fe9f8db37a72cec66e2f766a7e2109d6f98` |
| `pg05-money.svg` | 288 | `ac02d8c16cd928eb40ff133cdfeb116e0997b054fa8450c4e40a79e98229c2d7` |
| `pg05-more.svg` | 225 | `ded6ef6e4079cbd7274213090123ddaa306e3ce5ac1dcc59192b3257d388c9bd` |
| `pg05-pin.svg` | 400 | `b478e0e270310d7a33f39cf3619037e02e7b70271b0e5d8c75056a479211e818` |
| `pg05-shuttle.svg` | 289 | `232a17d687332ed81598b838830e832b1a728135a4b3c7f3fbb5ae52959479c7` |
| `pg05s-check_fill1.svg` | 174 | `6e9a6f4799b124417e754b5210e0d03420f65323bf3c84ce0ece2d5a8376dc51` |
| `pg05s-sports_tennis.svg` | 574 | `7cb15d9ec3d6f39ca080b843318ae1237fe4fd3fc8d871ddaf9da9dc051d6289` |
| `pg05s-calendar_today.svg` | 321 | `41509ee59a21aadc07999f4548b268cbb4677a625e4587b8669a7d6aea6b70a0` |
| `pg05s-edit_calendar.svg` | 502 | `29d45c6a7980034413a081f2f0960bc39defc0b398eb5248c4e572e6daf6ffcc` |
| `pg05s-location_on.svg` | 441 | `bb176877e344f00816c6e4fb28d981471f6c8d0a5d4e61eb46871bf7452ce1ae` |
| `pg05s-navigation.svg` | 220 | `4d540ef6634e8db4a3697301aeba7160dbe18fc6dba3f51445d3a4525cec9ace` |
| `pg05s-payments.svg` | 510 | `4d1f7a5000813bc38f546c28687b54776ce968df5a0c5fdf519d24731ef4518a` |
| `pg05s-forum.svg` | 353 | `de66c37c5898a450ba8f0f48ee09e139d724de902b03969b4941a79a448baf6c` |
| `pg05s-group.svg` | 762 | `2b233ae657912ae0ae2787dd08c4e24eb11fcaa1d9d296bcfd7bc2efee152146` |
| `pg05s-chevron_right.svg` | 174 | `f320fa0e4c76cd9e99353bb2632b578c5718fc73a5a3cdec3771f41df958ca1b` |
| `pg05s-verified_user.svg` | 337 | `f6e627ed9325c0065390f22bb00ba6354eed4a9dd106351d7ff858cfe37eceef` |
| `pg05s-arrow_forward.svg` | 186 | `947f6c7303589519540cabb6ef8ba09e3ffa3e841f541348fda045d6854c7031` |
| `pg05s-ios_share.svg` | 333 | `e16c63d3d15b8195c5cddf22c5face6c0f62865b8308783c81b92331337bed22` |

WXML净**12,256 B**、WXSS净**21,176 B**、SVG净**7,419 B**、JS0 B，共**+40,851 B source raw**。不是CLI主包或分包实测数。无业务数据、照片字节删改。root后续迁移activity／测包／限定native和真实回读报名流程／字体／旧URL兼容独立记录，不能用本源检查替代其证据。
