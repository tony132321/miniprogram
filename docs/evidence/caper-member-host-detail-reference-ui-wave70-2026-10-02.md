# Wave70 `_2` 已确认成员／`_4` 主办详情 — 来源与实施冻结

日期：2026-10-02。按已批准计划，同一 event owner 在 PG07 阶段冻结后顺序完成详情。完整原 HTML／PNG／当前有效 CSS、detailsSection、header／poster 与实际业务函数已读。不是新名单页、`_5` 或 PG06-S 背景实施，也不是全39屏验收。

## 精确作用域

共同 guard：`READY && !successState && !joinConfirmation && activeSection === 'detailsSection' && display.isBadminton && (isHost || myRegistration.status === 'CONFIRMED')`。其中非 host CONFIRMED 对应 `_2`，isHost 对应 `_4`；其他报名状态、非羽毛球、PG01、PG04-S／PG05／PG05-S、其他 sections 与 generic fallback 保持原段。

原 header56px、44px back（成员glyph22／主办glyph24与-8px margin）、32px person／glyph18；17/22/600 title。复用实际 statusBarHeight／headerPaddingRight，source fixed顶栏以sticky top0和自然流预留适配；只有标题必要时ellipsis。成员原active背景、主办原active scale.95／source decorative pulse也按原角色接入native hover-class／局部CSS，无新业务绑定。

## 完整来源与准确资产

来源／ZIP哈希、原有效px与角色字段见 `docs/design-sources/caper-member-host-detail-wave70/source-manifest.json`。完整HTML留存 `_2-original.html`／`_4-original.html`，两份原PNG为原解包路径，未重新绘制。

两张场景图为原JPEG字节：成员61951B／SHA `c15f89f32e5d3566cfc04e3013af6f30517f84117bbcbaeaf5834fd4103e7754`；主办59343B／SHA `1783413ef8fb173f0525e5362bb2066aa89ed974a399e6ffa91ae7638d573432`。原两地图URL返回同一原始 **PNG**（152383B／SHA `e1d1bcce15bff6996ff3a7bd9f3bb25061ab760221376a7fe8f1523b6b587e64`），仅保存一份 `pgd-map-illustrative.png`，没有重编码；四个响应headers、URL与dedup证明保留。第一Python读取TLS失败，既有curl取原响应成功；不是改图或改变来源。原图片均512px宽（hero279px高、map512px高）。产品图片显示 source background-cover/center 对应 aspectFill，224px hero／144px map；必须明示示意图且不绑定假地点导航。

15个新SVG共9619B，均来自已留存原最后官方 full Material Version2.972。两原稿最终同family后置link覆盖此前face，实际 default400／fixedopsz24／GRAD0；FILL1应用active rclt，verified.fill、calendar_clock.fill、place.fill、near_me.fill等完整原字形／颜色／Unicode／路径见各 material manifest。已有 back／person／calendar／violet pin／绿色check按同path同color复用。原 hourglass／add 仅用于假第7／8席，保留来源记录而未进入产品。字体二进制没有进app，无新依赖；许可仍是已留存 Apache2.0。

原 `_4` 的 w-13／h-13 不存在有效定义，没有猜52px。原PNG四列头像按源格宽排列；真实匿名占位使用四列格宽100% +1:1比例。成员原48px头像、3列／gap8，主办4列／gap12；名称／角色使用原700、600及指定500角色，source500在现有四Jakarta脸匹配400，没有套用Profile500 alias。准确 shadow-sm 为0 1px2px0/.05，hero原shadow-md；custom／inner并未统一替换。最终定点 source role／native interaction证明各自逆除回前一已验字节，无旧检查重跑。

## 真实 R1 语义与现有动作

标题、时间、费用、状态、人数、预留／候补／待审／重新确认，均来自当前真实字段；hostAlias与memberCards只用授权活动昵称／avatarGlyph。没有Luna／Alex假人物照片、技能星级或100%履约率；昵称公开列表明确与确认人数分开，并可能包含候补，普通成员未拿管理 confirmedRoster 作为公开名单。

成员真实CONFIRMED卡保留签到入口，凭证行显示个人凭证尚未开放／现场动态码规则，不造席位#5、IRL-PASS或永久个人二维码。主办状态和footer用真实 display.status／reviewStatus／visibility，未把邀请活动显示为已公开，未声称自动监控。地图是原稿位置示意，未承诺本场坐标、停车通道或导航；真实copyVenue保留。source静态规则改为现有 approvalMode／cancellationRule／venueStatus；原审核、AI草稿来源说明、版本、更新、成局风险、暂停、人数与安全声明仍完整保留。

header原分享／安全动作迁至局部 `.pgd-route-actions`；goBack与报名入口仍在source header。公告／签到／费用／主办工作台、举报、复制安全信息都保留现有handler和真实前置条件。

## 唯一定向保护检查

`bounded-scoped-check.json`：新区域／header guard／rootclass逆除后，完整WXML与**修复后PG07阶段145698B**逐字节相等；旧**172787B CSS前缀**逐字节相等，包含原Wave69 162268B和最终PG07 CSS。PG07 source段和6新SVG保持，81个旧activity assets保持。最终WXML结构可解析，SVG路径／颜色／实际FILL1／引用与三图片原bytes匹配。

header+detail 的角色静态契约核8个case（host／成员 × stats有无 × alias READY／ERROR）：活跃节点数为host16/15/13/13、成员15/14/12/12，与原完全相等，含handler／data／id／value和业务条件；是局部保护证明，不运行业务API。generic unreachable节点继续在原字节fallback，不用删业务换简化节点。图片格式断言发现原地图为PNG后，按原bytes改扩展名，续做资源保护；8个已通过角色证明输入同hash直接复用，没有重复跑。

JSON69B SHA `bf33dc7da099d240642a50fe3cf44cee01a2b282f70a80a313c79317c76ad10b` 不变。**root唯一JS例外**：签到QR移入activity，event.js第二行require由`../../../utils/checkin-qr.js`改`../utils/checkin-qr.js`；当前104041B SHA `97e9f505d58b4b10e4d74d0e360954a0bac4730e1ddbef3437efeba6ed17621e`。只逆回此6B入口差异即与原104047B／SHA `ccb5b5fede066ba0533b82cb564e816cc3d45ca96778a0d25ac5286d3c11a4bd`逐字节相同，我未修改JS。PG09两处roof图引用保持root已授权activity局部迁移路径；文件搬移由root做，其他69模板不变。

## 最终冻结／入口

详情20产品路径＝两模板 +15SVG +两JPEG +一PNG；阶段当前产品净增**320242B**。连PG07最终6SVG／模板累积当前产品净增**341500B**，共**26产品路径**（两模板+24assets），新增main资源／字体0B。root自己的QR／roof资源分包迁移不计入owner净增；最终压缩包体由root限定CLI实测。

最终模板：WXML160928B SHA `69b231e3f4d506d2e3d46653bf9075e4ebaa69cdd06bcaf9b82b89d9c8fffa31`；WXSS194503B SHA `d26cb609e200446af02965b5840bf1fe0f01f21b66e8841da6289022e6881ce0`。每path精确字节／hash以 `/private/tmp/caper-wave70-details/frozen-owned-paths.json` 为准，阶段快照 `frozen-product/`；PG07独立审查已完成，详情独审另交最终快照，禁止混读进行中旧版本。

运行selectors：`.pgd-native-back`、`.pgd-native-person`、`.pgd-hero`、`.pgd-confirmed-card`（成员）、`.pgd-host-state`（主办）、`.pgd-copy-venue`、`.pgd-roster`、`.pgd-destinations`、`.pgd-route-actions`、`#eventReportButton`、`#copySafetyDetailsButton`。member需真实非host CONFIRMED；host需真实isHost；均READY／details／羽毛球／无success或报名确认弹层。公开昵称／stats有无由实际回读显示，无新增记录或身份切换API。未运行SDK／微信／CLI／Git／CI／全量或旧142；此证据是来源、静态绑定及无损保护，不是当前运行PASS。

### 最终 tracking 来源定点

独审者只读原稿CSS-observation已明确wide=.025em、wider=.05em、widest=.1em。source原11px wider各role为.55px，成员terminal13px wide为.325px；已将新scope三处1.1px及host时间／地点label改回实际值。个人凭证蓝色value使用原17/22/600、font-mono、tracking-widest1.7px与真实短闭态“尚未开放”，不显示PASS号。PG07主办chip同一来源wide应11*.025=.275px，仅一值修正+1B，stageCSS当前c72cc637…／172787B；3个已通过源交互修复与全部bindings／glyphs不变。`final-tracking-role-proof.json`和PG07 `final-chip-tracking-proof.json`各局部inverse精确恢复前版，不重复全scope检查。

### 独审后 _4 主办范围四类来源纠正／最后冻结

root明确授权仅修独审4类新hostscope，局部源节点已回读。透明roster外层无padding/shadow，heading横4px／距grid8px；只有真实昵称grid为白色p12/r12/shadow-sm，hostcaption11/14/700/.22。授权为空时使用同白卡native框，明确真实empty/error，声明继续在透明外层；成员scope原样。状态主行#424655、hero标题#fff。host map恢复source shadow-inner 0 2px4px/.05；因为native图片是child，:after仅投射准确inset边缘，pointer-events:none。footer原外pt2额外8px以host margin-top补回。真实capacity拆为confirmed17/22/800/primary、denominator17/22/600/variant、unit11/14/700/.22，unit保留“人已确认”来维持R1席位语义；绑定外层／data／handler与成员文本不变。

`host-review-source-correction-proof.json`只检查此1931B delta的inverse与新增metricfragmentXML（标准化WXML boolean wx:else后解析）；WXML逆回精确恢复root已迁图的160626B／SHA dd067d9f…，CSS删最后1655B精确恢复此前192883B／162f2291…；没有重跑8角色VM、旧binding/glyph/resource/sourcechecker。当前完整四文件快照仍在final `frozen-product/`，前审字节另存 `frozen-product-before-host-review/`。

root新增资源迁移例外另有**9个**精确photo字面路径：pg04s两处→`./assets/pg04s-badminton.jpg`、PG01两处→`./assets/pg01-badminton-player.jpg`、itinerary五处→`../assets/itinerary-badminton.jpg`。新模板保持全部9处；只逆回它们即可恢复前审完整160675B／c6e223b8…字节。本次owner源码UI修正+1931B，root此9ref文本合计−49B；当前26产品实际净增341509B（sourceUI按此前freeze累积+修正=341558B，二者差49B）。root的此前PG09两roof refs和event.js QR单行入口迁移也仍保留；我没有搬资源或写JS/JSON。后批Wave71产品继续冻结，临时prep未进入本提交范围。

### 定点 native 状态主行选择器修正（待 root 补验）

root限定SDK保留的`/private/tmp/caper-wave70-host-source-delta.json`显示：roster emptyframe/caption已过；hero标题#fff已过；状态主行实测rgb(26,27,31)仍未达source#424655，map/footer/capacity当时未执行。没有把这条失败移除或把静态独审通过当native通过。实际WXML包含条件text节点，复杂structuralpseudo选择器未落到真实主行；native内部matcher原因不另作未经验证断言。

root授权仅为真实主行加`pgd-state-primary`class，改用`.pgd-host-reference .pgd-state-primary{color:#424655}`；保留旧fallback未加class、全部文本/动态值/权限条件/事件/9photorefs/QRrequire。`native-status-selector-correction-proof.json`保留失败输入hash；仅此两处inverse逐字节恢复先前已独审c4485f98…/d6b709bb…，WXML+26B／CSS−35B，净−9B；没有重跑四类/8VM/resource/glyph/sourcechecker。当前sourceUI累积341549B、root9ref文本−49B，实际26产品累积341500B。最终runtime仅由root补此项与未执行项，未重复已过roster；我没有使用SDK/微信/CLI。
