# Wave 71 `_5` 主办方只读看板独立来源审查

日期：2026-10-02。审查者：`ui64_review`。只读独立审查；未修改产品、配置、Git、微信工具或共享矩阵。

## 结论与范围

在下列冻结版本中，未发现新增入口权限、数据真实性、来源素材或旧功能保护的源码缺陷。14 处 JavaScript 与 3 处 WXML 的差异精确逆除后，完整文件恢复 Wave 70 immutable 基线；旧 CSS 前缀、JSON 与 108 个旧活动素材逐字节保留。新增看板正文没有操作绑定，仅新原生页头复用既有返回与报名名单入口。

**渲染边界：**根代理实际截图左上设备圆角外侧有一小段灰文字。定点原生诊断确认滚动位置为 0、页头在顶端；最终补查旧详情/海报实际 `display:none` 且宽高为 0，没有对应可见页面节点证据。近顶 `selectAll view` 桥不完整，辅助断言预期至少 1 项因此失败，原记录保留。该处作为 capture fringe 未定位/原生前台待验边界，不据此盲改 source blur 或旧区域，也不宣称完整像素验收通过。

本次不重跑实现者 82 项来源检查或 6 组行为测试，不新增样式镜像测试，不执行全量、CLI、SDK、CI、真机或正式环境测试。

## 冻结输入

Owner manifest：`/private/tmp/caper-wave71-host-monitor/frozen-owned-paths.json`，18,123 B，SHA-256 `4af895e0116b1d78e2607902aad9030e1dff0c785ef425213adc0dde523e2c58`。只读产品副本：`/private/tmp/caper-wave71-host-monitor/frozen-product/`。

| 活动页冻结文件 | 字节 | SHA-256 |
| --- | ---: | --- |
| `event.js` | 106,348 | `85db2c73f3b832944782f8913a1ee9cf3a2d4468b54b4ea709e108c76ab26634` |
| `event.wxml` | 172,013 | `c23f5ee9f7b9d3238d6597fcf92ef18ff69bd9615e601d65261afeba3dc18680` |
| `event.wxss` | 206,812 | `a62ec5123dcf1a4866023d83571a06968fae3377c8e374b19044ca874e2b26b8` |
| protected `event.json` | 69 | `bf33dc7da099d240642a50fe3cf44cee01a2b282f70a80a313c79317c76ad10b` |

所有路径位于 `miniprogram/subpackages/activity/event/`。11 个产品路径与 protected JSON 的实际冻结字节、长度和 manifest 均已独立核实。

已完整读计划、先前 `_5` 只读审计、原 HTML 与最终新范围，并实际查看原 PNG。用户 ZIP SHA-256 `df22e733d33fda20979b75b8a7bc94717c4a5c9e41561a54e3038432fab32603`。ZIP 中 `_5/code.html` 25,760 B / `e2a2ce2fb2266283f7762dca23592c732eca385d88ce1772f1e22a41bec8b024` 与 `_5/screen.png` 377,418 B / `c304525527f9fcab9c7e6646ed13e8b63a3febeff3c34880f8f1ff91f7b7b3cb` 均和原件精确同字节。

## 独立保护核验

一次独立必要核验结果保存在 [source proof](caper-host-monitor-independent-source-proof-wave71-2026-10-02.json)。核验不调用 owner checker。

| 保护范围 | 独立结果 |
| --- | --- |
| 完整 JavaScript | 14 处逆除后恢复 104,041 B / `97e9f505d58b4b10e4d74d0e360954a0bac4730e1ddbef3437efeba6ed17621e` |
| 完整 WXML | 3 处逆除后恢复 160,928 B / `69b231e3f4d506d2e3d46653bf9075e4ebaa69cdd06bcaf9b82b89d9c8fffa31` |
| 原 CSS | 完整 194,503 B 前缀 / `d26cb609e200446af02965b5840bf1fe0f01f21b66e8841da6289022e6881ce0`；追加 12,309 B |
| 原资源及 JSON | 108 个旧 asset 与 JSON 均同 immutable 70 字节 |
| 新看板正文 | `bind/catch` 操作属性为 0；`input/textarea/form/canvas/map` 为 0 |
| 新页头动作 | `goBack`、`jumpToSection`；后者目标仍 `registrationSection` |

新增选择器集中于 `.hm-native-*`、`.event-page.hm-reference` 与 `.hm-*`；未将普通详情、旧主办长表单或其他活动分支修改成新看板。原更多菜单 `stillCurrent` 整块保持。

## 入口、身份与真实数据

逐项静态读最终函数与新增差异，未执行重复行为测试。

- 看板资格要求 `READY`、非报名确认、`isHost`、活动 ID 一致、活动 `hostId === currentActorId()`、当前页面身份与当前 session 一致。协办资格不等于看板主办资格。
- 深链接先完成原刷新，再核返回活动 ID、当前身份与主办资格。菜单仅对合格主办人追加第三项；原 actor、活动对象/ID/版本、页面身份、load state 与 refresh generation 校验保持，第三项再核同一操作上下文与当前主办资格。
- 返回从看板回本场主办工作台；资格已失效时回详情。刷新失去身份/资格会回详情，身份切换和刷新失败清空看板统计。原 `onHide/onUnload` 清理整块通过逆除保护；没有发明新的 unload 契约。
- 四格只使用服务端 `confirmed/reserved/requested` 与真实 `min/maxParticipants`。缺失、不安全整数或无效边界返回不可用，未伪造 0。进度由真实确认人数计算，视觉宽度最大 100%；“达到人数不代表已人工成局”明确保留。
- 场地绿色来自主办方 `HOST_CONFIRMED` 声明；明确不是场馆锁位。审核与风险条件使用当前真实字段，未保留虚构 48 小时判断或天气通知。
- 名单使用既有实际 `CONFIRMED` 报名与本场授权昵称/匿名标识投影。没有复制源 6 人照片、名字、技能或付款；右侧明确付款未由平台核验。EMPTY、ERROR 与尚不可用分开呈现。
- AI、自动提醒、实时云同步、预订凭证与付款能力保持真实关闭说明；看板只读、无自动每 15 秒刷新承诺。

已只读核服务端现有 stats 与报名接口，以及原昵称授权投影。此处是字段/权限契约核对，不冒充一次真实 API 测试结果。

## 来源几何、字体与图形

下列为完整原 HTML config/class、已缓存有效 CSS 与最终追加 WXSS 的来源对照。数值按原 CSS px 保留；没有改成 rpx。未新增字体。原 Plus Jakarta Sans 400/600/700/800 请求不依赖 Profile 500 专用别名。

| 角色 | 核对的原有效值与最终范围 |
| --- | --- |
| 页头 | 内容行 56；返回触区 44 / 左移 8 / glyph24；标题17/22/600/−.17；蓝 circle32/person18；原80%底色、blur24、来源轻影 |
| 页面与 intro | side16、bottom24+safe、卡间12；intro mt8/gap4；20/26/700/−.3；badge4×10、gap6、dot8、11/14/700/−.275 |
| hero | p12/r12/原 shadow-sm；标题22/28/700/−.44；128/112光晕与blur40/24；sport48/glyph28 |
| 四格与进度 | 四列gap12、p8/r8；数字20/26/700；标签11/14/700/.22；进度10px、700ms原 easing |
| 条件 | p12/gap8；17/22/600；rowp10/r8、左gap10、circle24/check16实际700、右ml8 |
| AI | 原三色透明渐变、28px orb/原彩色shadow-md、16px glyph/9s spin、body15/24.375；`shadow-xs` 无效未补猜 |
| roster | p12/gap8、headerpb4、rowp10/r8/gap10、avatar40；真实主办行保留源700/副文案 variant 与普通600/outline的角色区分 |
| map/footer | map128/r8/mt8、overlay10；footerpt4/pb8、pill8×16/gap8/rfull、13/16/600/−.325；`py-0.2`/`shadow-xs` 不补猜 |

原 source status mock 不照搬；真实 `statusBarHeight/headerPaddingRight` 与原生胶囊适配采用既有 helper。sticky 页头替代源 fixed 的布局方式是有记录的原生适配，来源 56px 内容尺寸保持；并非两个环境全屏几何逐像素相同证明。

独立 FontTools 4.60.2 从留存官方完整 face 重新实例化 400/FILL0、400/FILL1 与 700/FILL0，逐一核 11 variants / 14 原消费者。WOFF2 1,136,920 B / `77f9711f3f896a1d7a34ab95cffc45cfb17d84c223f197c1b90faa0d043006e9`；实际仅 FILL0–1 / wght100–700 两轴，opsz24/GRAD0固定。对实例 GSUB 的实际 `latn rclt` 独立遍历后，`sports_tennis.fill` 与 `verified.fill` 正确；3处 check 实际700。全部 runtime path、paint 和 viewBox 与官方 full face 精确一致，无坐标舍入。

person/auto_awesome 的旧 runtime SVG 序列化与新 canonical export hash 不相同，但 path/paint/viewBox精确相同、runtime仍和旧基线同字节。独立 proof 分开记两种 hash，未用一个 hash 冒称另一个文件的字节。四旧图标复用，七新 SVG 5,828 B。

地图 152,683 B / `8c4881b9d74ec892c8549613ab1426b0a11c54793cdb073ffd6540c2805d02f4` 与准确原响应同字节。实际截图显示上海原示意地图与深圳真实活动地点并列，同时明确“原稿位置示意图·不代表本场坐标”；这是有意来源图示，不是本场地图。原 portrait 没有下载或混入包。

独立 FontTools 临时 harness 首次错误依次是轴数组顺序假设、遗漏 SVG 的 y 轴翻转、混淆 canonical hash 与复用序列化。最终更正仅在私有核验脚本，未改产品；最终精确匹配不使用数值规整或舍入。记录保存在 source proof 的 harnessCorrection。

## 根代理运行证据与剩余观察

根代理报告冻结 clone 的限定 SDK 11 项通过，含真实本地主办菜单、6 个已确认/1候补、6行名单、深链接、成员阻断与返回；菜单打开通过 SDK 回调，不能冒称真实物理菜单点击。根 CLI gate：total4,335,244 B / main2,010,442 B（余86,710）/ activity1,369,494 / profile955,308。本代理未执行该 gate 或 11 动作。

已实际查看根两张 monitor 图与顶边诊断图。初顶边诊断 `/private/tmp/caper-wave71-host-monitor-top-diagnostic.json` 两观察通过、无 runtime exception：nav top0 / height110 / padding-top54 / sticky / z50 / rgba(.8)，scroll0、近顶 text0。但截图仍有顶边细灰文字；源码旧 poster 与 details 的 `section-hidden` 唯一有效规则为 `display:none!important`，没有新 hm 文本伪元素，也未见 source 确认的旧绝对文字漏出。根最终仅补一次定点 view 检查：`/private/tmp/caper-wave71-host-monitor-view-edge-diagnostic.json` 中 native 与 SDK 近顶 view 集合均为 0；明确单独读取的 `#detailsSection.section-hidden` 与 `.poster` 均实际 `display:none`、width0/height0。先前 explicit nav110px读取成功，因此辅助断言把不完整 `selectAll view` 桥预期成 near-top至少1项而失败，不能当产品失败，也没有重复诊断。图细灰位于设备圆角外侧截图边缘；未找到源页面可见文本/extra view。保留 capture fringe 未定位与原生前台待验限定，产品不动，独立源码结论冻结。

本结论不覆盖全部 39 页面、真实字体绘制/换行精度、手机系统差异、真机或正式 AppID/HTTPS/订阅消息与运营验收。

## 最终冻结

来源保护、11/14 字形与入口/真实性静态核验完成；没有未解决的产品源码整改意见。末次补查只更新此独立证据的截图观察边界，未修改产品或重复原 checker/动作。独立 source proof 包含最终诊断原始 SHA 与辅助断言失败，不能将其改写为全 PASS。
