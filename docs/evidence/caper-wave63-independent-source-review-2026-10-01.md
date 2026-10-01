# Wave 63 独立原稿与源码复审（2026-10-01）

## 结论与范围

本报告由未参与三页实现的独立审查员完成。已读取已接受计划、三页原稿差距审计和实现证据，完整阅读原 HTML，使用 `view_image` 查看三张原 PNG，并复核冻结 WXML/WXSS、相对基线 `6be9ceb2160b8a3ff142948b947d7f94b8765cd1` 的必要 JS／测试差异及资源来源。

**本批源码复审未发现需要修复的 Critical、Important 或 Minor 缺陷，可以交给根代理执行三页定向运行时验收。** 这不是运行时通过、整页逐像素相同、全项目完工或可生产发布的结论。本审查员只新增本报告；未改产品、索引／分支／提交或共享验收表，未运行微信 CLI、SDK、Automator、CUA、业务测试或全量测试。Git 仅用于只读基线比较。

## 原稿读取与换算

原稿根目录为 `/private/tmp/irl-stitch-original/stitch_design_system_generator/`。三份原 HTML／PNG SHA-256 已实际计算，均与独立审计一致：

| 页面／原目录 | PNG 尺寸 | HTML SHA-256 | PNG SHA-256 |
|---|---|---|---|
| city／`pg02_loc_city_selection` | 219×1600 | `3806ef705727d39e89ce8ddcde8ef46539e16d78624cee1fbf8425962bf690e5` | `e716caf0d8cee09aafa3468f7d78a7454d019116732b04ae8e71f39b8a9aae9b` |
| itinerary／`_1` | 561×1600 | `7fd05770991f1772cac4b01eb3d8d2f3bd18051dd5b85bb2be319bb1ac5bea58` | `a0ce3c1933e3c884b13d0ca75c3d301565d66bf284116183f10e773ec7f4743e` |
| share／`_3` | 570×1600 | `dc13ab1a0889aefa66090c208839573e24f925a6969bc220ca86bc0dd4a9622b` | `349d2b42e3da3c00e1654ad0ffcd37f6831dfc7b10e3969ad2b20b1641ec1779` |

几何依据 HTML 明确 CSS token，在 375px 窗口以 1px=2rpx 核对；原导出长图宽度不用于推算设备 CSS 像素。字体、最终 Web Font 字体轴和实际微信渲染尚未测量，不能从官方图标来源或源码尺寸推导逐像素等同。

## 分页复核

### 城市页

已核 56px sticky 顶栏、实际状态栏 fixed 非交互底色、44px 返回／更多和32px蓝头像、原24px blur 对应48rpx、独立搜索停靠在实际状态栏+56px下。搜索44px／r12／15px，热门44px／gap12，城市48px／15px，标签／省份11px，组头15px，空态及页尾均按原 token 恢复。中文标题和真实手动浏览说明保留。

两层 rail 为 right4px、top 实际状态栏+144px、bottom80px；外围36px宽、padding8×4，内层 padding4／gap4、20px字母／11px字。外层 `pointer-events:none`、内层 `auto`，层级低于头部和搜索，未新增覆盖全列表的点击层。`jumpToLetter` 保持原 letters 与组 id，只在原生 selector 几何可用时采用 `max(0, viewport.scrollTop + target.top - sticky.bottom - 4)`，让组头处于实际搜索停靠区域下方4px；旧客户端仍有原 selector fallback。

JS 仅增加胶囊+8px布局字段和该滚动净距计算。城市工具、JSON及原选择／保存／返回／搜索／清空焦点／说明行为保留；没有GPS、142场活动或申请已收到的虚构反馈。删除额外搜索计数标题、用真实 search16 蓝图装饰现搜索入口，以及不实现伪 toast／申请 slot，均符合已接受计划。

### 我的行程

原 HTML 头部为 fixed；最终 WXML/WXSS 已补 `position:sticky`、实际 `statusBarHeight` 的 top、fixed 状态 cover 和 `pointer-events:none`，页面正常状态栏占位保留。56px头／44px返回／32px头像和实际胶囊+8px预留均存在。必要 JS 仅增加该布局 helper 与 data／onLoad／onShow 字段更新，原 refresh、请求、日期、筛选、排序、身份清理、状态与三种分区导航均未改。

主卡20/26px标题、13/18px副字、p16，facts p12／gap10／28px图盒／18px glyph，日期副字11/14px与地点／费用13/18px分开。原176px cover和类别 JPEG保留；渐变底白100%／中段 on-surface20%／上透明。后续卡 p12／gap12／r16、48px日期盒、17/22px标题、13/18px说明、11/14px状态胶囊符合原 token。

粉／紫日期盒只按索引改变装饰，真实状态未被源“待成局／预约备忘”替换。后续详情箭头及主卡报名、签到、详情按钮是既有真实导航适配，绑定和 `data-id` 保留。真实说明仍明确未同步系统日历且不生成永久入场凭证；没有注入固定日期、Luna队友或PASS样本。

### 活动邀请卡

已核56px fixed 顶栏、实际状态栏 cover／胶囊预留、8px蓝／青柠／紫彩条、r16白券、20/26px活动标题、真实人数胶囊、facts p14／r12／gap10／28px图盒／15/20px主值。券圆缺口为28px、左右-14px，虚线2px、左右margin20px；父券 overflow-hidden 只裁外半圆，QR白框未裁切。

页内 canvas 内联160×160px，白框 padding12px／r16px，总框184×184px；这里采用固定 px 与 canvas 一致，其余布局按rpx换算。JS 唯一差异是页内 `paintInviteQr(...,160)`，M级、`count+8`、4模块逻辑quiet zone及原 floor／ceil 算法不变。海报仍绘制200px QR、离屏画布360×600；无IRL覆盖、装饰SVG或transform缩码。光栅舍入和实际可解码性必须由本轮实际截图验证。

口令完整动态绑定未截断、插空格或替换为样本；整宽灰盒 p12／r12、18px key及允许换行的文字布局存在。三处 `copyInvite` 和两处 token 展示保持，弹层保留原4枚资源和复制／分享／海报流程。三说明卡 p14／r12／gap12、36px图盒／20px F1 glyph、17/22px标题及13/18px正文保持真实状态／报名／场地费用说明。原主办字段无真实来源，未造Luna或account_circle主办槽；photo_camera仅用于准确的待生成海报提示。

所有 canShare、shareReason、报名截止、服务端剩余有效期、脱敏地点、身份、离页、版本与最终复制重新核对逻辑均保留。既有测试唯一差异为页内白底160px边界，未改poster测试；本审查员未重新运行实现者已记录的单文件测试。

## 一次独立资源与绑定检查

执行只读 Python 检查，exit0。不是业务测试或运行时验收，也未创建产品镜像测试。

| 页面 | 新官方 SVG | SVG bytes | WXML 本地引用／唯一资源 |
|---|---:|---:|---:|
| city | 15 | 5562 | 15／15 |
| itinerary | 9 | 3735 | 9／9 |
| share | 11 | 5015 | 17／15（含既有4枚弹层资源） |
| 总计 | **35** | **14312** | 全部实际存在 |

- 35个 manifest条目逐项核准确名字、FILL、源色值、产物SHA-256和SVG XML。34份固定SVG的官方URL精确含提交 `bd8cb85bd4bad964fe6918f79665bb40c3a8efef` 与同名 `[_fill1]_24px.svg`；源缓存SHA-256相符，去根fill后XML／path完全一致。Outlined／wght400／GRAD0／opsz24轴记录一致。City F1仅near_me／location_on／auto_awesome；itinerary timer／check_circle为F1；share sports_tennis／bolt／groups_2／receipt_long为F1。
- place 独立官方字体证明已核CSS及2032byte TTF散列、无fvar、960UPEM、静态Version2.972和请求轴；cmap序列 p,l,a,c,e 在GSUB唯一匹配 `uniE0C8`。重新以原 SVGPathPen+y-flip 描出path与产品逐字相同，path SHA-256为 `e71dff61f23ee1bceaf5ebc50a95fd1aa4c5a3c74618766def380ff9ad19a1aa`。未将place换名为location_on，也没有字体进入小程序包。
- WXML仅为通用XML检查器声明wx命名空间、规范化既有boolean wx:else并转义字面&后可解析；产品源码未因检查器改写。三页原 bindtap／bindinput／data-id／data-city／data-letter 属性集合与基线一致，结合实际markup复核未删除真实入口。
- QR vendor、poster测试、城市工具／JSON及弹层4枚SVG，共8个文件与基线字节相同。三份JS差异已直接阅读，符合各页已批准的局部例外。

## 冻结源码快照

此表实际计算值均与实现者最终交接记录一致；后续root修复若改变文件，应另记最终hash与相应窄复核。

| 文件 | SHA-256 |
|---|---|
| city.wxml | `7cec49adfb88995cbc1a9fa69adf7376d7dabf2892b43410cd6260582c163c0d` |
| city.wxss | `79fc9be6a07948f47530030194d098f4376cd183d629962ec7ffc362333bb361` |
| city.js | `271d93efcdadc8511751216f8e89459eac67640f5d27fa9371ee1776cb1506ae` |
| city assets manifest | `44814d81d20c1006a38a94b36f2b30f8b61171359c8ca67366e4d41214f703f4` |
| itinerary.wxml | `0d66c8b675decf27bc57511d7b0935c6883438bf2dededdf26e6820d0affaeea` |
| itinerary.wxss | `42faee430c7d58612c8e1c8e2f8560f8c5f1ce4c01e00de65bdf8f5e74271cf9` |
| itinerary.js | `5c0e933ed6a67b7bc90d7d1f6510e84d22ecf9d9abd006456fe787dead8e61c7` |
| itinerary assets manifest | `708c6d076db64c127bbfb2043baa8e574401e7c2334b66adf1856f5748029261` |
| share.wxml | `fa6664d9fc3a697509fee78362a4dbec909b6051cc7a6656655622a6f1560af5` |
| share.wxss | `8309549f016b13b98e2496551089e88a069265c6d0b60b2ac8bb5a3b562f196c` |
| share.js | `5fdde14c88902bb18e4c045d81326974978d718c6181d94cf76c86f2177a8258` |
| share assets manifest | `8151f2fd7f932ab68cbe338593212013c24f3867b00c32f36b402116831691c0` |

## 未在本审查中判断的事项及原因

- 实际客户端capsule净距、滚动停靠、city搜索焦点／选城保存返回和字母组头可见性：需要根代理独占运行时工具，源码与几何公式不能替代实际操作。
- itinerary本人首卡、两张真实后续卡及同id详情返回：需要当前API记录和运行时证据，不为凑原样本创建虚假活动。
- share实际160px码完整解码、主券／弹层复制实点、闭合分享态：源与stub测试不能证明截图可解码或实际按钮结果；需根代理本批定向验证。
- 三图固定样本内容、GPS／公开活动密度／申请toast、队友／PASS／日历同步、免审核／自动成局／预订场地／已生成海报：这些没有R1真实来源，计划已明确保留真实边界；不把对应样本槽缺失误标为功能缺陷。
- Plus Jakarta Sans、网页最终字形轴、backdrop-filter实际效果及39屏整体逐像素：超出本批源码证据，需要独立视觉测量，不能从35份正确SVG推导。
- 正式AppID／HTTPS合法域名、微信原生发送送达、订阅消息、真机、真人运营与三场活动：本轮没有相应外部验收资源，不从本地源码审查推导通过。

本批建议只继续已计划的三页定向操作与最终编译／包体检查。没有新证据要求扩大为全量测试或重跑未改的业务矩阵。
