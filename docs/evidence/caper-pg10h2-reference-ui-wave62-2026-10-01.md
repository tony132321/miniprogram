# PG10-H2 Guidelines 原稿恢复 — wave62

日期：2026-10-01。Task3仅修改 `miniprogram/subpackages/profile/guidelines/guidelines.wxml`、`guidelines.wxss`、本页独占 `assets/`，以及本证据与本地Task3报告。业务JS、navigation与common样式未编辑。未执行Git操作、CLI、模拟器、全量/业务套件或照搬样式的镜像测试；本记录是资源及源码证据，不是模拟器、真机或发布验收结论。

## 原始依据

完整阅读 `/private/tmp/irl-ui62-reference/pg10_h_2/code.html`，并查看原始 `screen.png`。原PNG为383×1600px；恢复采用计划规定375px=750rpx的HTML尺寸换算。

- HTML SHA256：`0a7871c7b3ab496e593b9f41cc493b711160c43dbcc4932debb5afbfd81b3fc0`
- PNG SHA256：`5f3d160c6f91b4025bfe68b5016853492992396dbd219c8cfa24abca9b99e212`
- 完整计划及Task3 brief已读。交接时独立gap audit尚未出现，由根代理在整合阶段补充协调。

## 恢复内容

| 原HTML几何 | 本页恢复 |
| --- | --- |
| 16px页边，12px首屏上间距，16px卡片间距 | 32rpx页边、24rpx header下间距、32rpx卡片间距 |
| 56px header，44px返回/share/more触区，32px头像 | 112/88/64rpx；返回24px、share/more22px、person18px |
| 16px卡片圆角与内边距 | 32rpx；正文容器12px圆角/内边距 |
| 64px渐变hero，32px FILL1 handshake | 128rpx英雄圆，64rpx握手图；28px粉色角标、15px FILL1 favorite |
| 22/28px hero标题，15px正文，三列价值条 | 44/56rpx标题、30rpx正文；守时/友善/透明沿用现有实际说明 |
| 40px章节外框，22px章节图形，17/22px标题 | 80/44rpx；34/44rpx标题；11/14px英文字号/行高 |
| 20px小点框、14px图形、13px规则正文 | 40/28rpx；26rpx正文，源leading-relaxed=1.625；三处1px分隔 |
| 隐私两条18px图形，无分隔 | check_circle/privacy_tip 36rpx，8px条间距 |
| 28px quote、24px绿色尾部圆、16px check、14px shield | 56/48/32/28rpx；原source视觉位置恢复，尾部保留实际举报动作 |

同时恢复原primary `#004cc8`、electric blue `#1D64F2`、violet `#5856D6`、pink `#FF2D55`、green `#34C759`及正文/容器色。Hero恢复原两个柔光背景圆、渐变方向与角标位置。Header sticky仍以 `statusBarHeight` 为top，复用JS实际微信胶囊+8px避让，新增fixed状态栏底色并设 `pointer-events:none`。

## 精确图形来源

21/21原HTML命名图形与本页manifest符号集合完全一致：arrow_back_ios_new、ios_share、more_horiz、person、handshake、favorite、schedule、event_busy、gavel、diversity_3、hearing、block、receipt_long、visibility、bolt、photo_camera_front、check_circle、privacy_tip、format_quote、check、shield。

所有图形均由规定 `/private/tmp/irl-material-symbols-wave60/export_symbol.py` 从Google Material Design Icons pinned commit `bd8cb85bd4bad964fe6918f79665bb40c3a8efef`导出。21个SVG共9,281字节。FILL1为handshake、favorite、check，其他FILL0；outlined/weight400/grade0/opticalSize24。只修改SVG根fill，原path/viewBox保持。没有404、font fallback或近似名称替代。

`assets/material-symbols-sources.json`逐项记录实际sourceURL、FILL、源SHA256与asset SHA256，许可Apache-2.0。源Webfont其余最终轴及Plus Jakarta Sans未逐像素验证，不宣称100%像素一致。本页原稿不含摄影资产。

## R1语义与业务边界

现有八条实际规则正文与hero说明保留，包含：取消依活动规则执行、重要变更重新确认、多元尊重、未经同意不得索取/传播私密信息、费用模式/上限说明、费用标记不是收付款凭证、活动相册未开放、举报/屏蔽/本人数据请求。三列继续写守时/友善/透明，末尾继续说明正式协议仍待审核与发布。

原稿gavel等图形仅按源位置呈现，不引入原稿100%出席、信用自动处罚、永久封禁、24小时付款承诺、一键模糊/撤回、正式社区委员会或认证保护已开启事实。原稿绿色尾部胶囊改用现有“需要帮助？前往举报与求助”按钮；check是该位置的视觉图形，没有新增已承诺或生效状态。goReport及其当前会话owner保护、分享元数据、菜单与返回逻辑全部沿用原JS。

## 一次必要核对

单次资源核对结果：

- WXML（wx前缀归一后XML解析）通过；21个image src全部存在、各使用一次。
- 21个SVG XML通过；逐项source/asset SHA256匹配manifest；去除根fill后XML完全等同pinned source。
- FILL1三项与原HTML一致；原HTML与manifest命名集合21/21一致。
- 八条正文加末尾正式协议说明逐字核对通过，goReport绑定保留。
- JS SHA256仍为 `9aecd0990288300443e88690a13c7405cbe7e34f2fc8811397a137bfae157cd2`，与修改前记录完全一致。

待根代理验证：微信胶囊保留空间下header标题自然截断情况、图形真实渲染和举报/返回入口。保留真实R1文案导致卡片自然高度和原PNG不同，最终中文字体/源Webfont轴也存在差异；不得把本源码核对视为全屏像素一致证据。

## 根代理整合后的最终快照

前文实现者自检快照保留为交接时证据；随后root定向修正原稿模糊单位及需要的text decode，详见本轮整体运行与独立补充复核。JS未改；最终源码hash如下：

| 文件 | SHA-256 |
|---|---|
| miniprogram/subpackages/profile/guidelines/guidelines.wxml | `2e397c22469dcbb89a7b302491cb2c9e7e724010bbb801b56dcbaa549a69ec88` |
| miniprogram/subpackages/profile/guidelines/guidelines.wxss | `6b5dad2203bfaa5b2009112807ee73b272e7486243bc1a8443f2c7147ced4927` |
