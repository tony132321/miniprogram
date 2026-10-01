# PG02-LOC 城市选择原稿恢复实现（Wave 63，2026-10-01）

本次仅实现计划 Task 1 的 City 独占源码、资源及来源证据。已完整读取计划、task-1-brief、独立城市审计及 544 行原 HTML，并用 view_image 查看原 219×1600 PNG。本文记录源码与窄行为验证；微信 CLI/SDK、模拟器视觉、真机与外部/发布证据由根代理后续单独记录。

## 来源与范围

原稿目录：/private/tmp/irl-stitch-original/stitch_design_system_generator/pg02_loc_city_selection/。HTML SHA-256：3806ef705727d39e89ce8ddcde8ef46539e16d78624cee1fbf8425962bf690e5。PNG SHA-256：e716caf0d8cee09aafa3468f7d78a7454d019116732b04ae8e71f39b8a9aae9b。几何使用 HTML 明确 CSS token，按 375px=750rpx，不把压缩长图像素当作375px设备尺寸。

改动仅在 miniprogram/pages/city/city.{wxml,wxss,js}、此页 assets/、docs/design-sources/material-symbols-place-fill0/、本证据及独占 task-1-report.md。城市工具/数据、JSON、共享样式、其他页面、共享矩阵、临时导出 helper 都未修改。15 个页内 SVG 共 **5562bytes**，另有页内 manifest；主包不分发字体。place 官方 CSS/2032byte TTF/source.json/README 四文件只在 docs 来源证据目录。

## 原稿几何与平台适配

| 区域 | 本页实现 |
|---|---|
| 状态与头部 | 原56px sticky行停靠在实际 statusBarHeight 下，固定状态覆盖层 pointer-events:none；surface85%与原24px blur（48rpx）；44px返回/更多、24/22px图，32px蓝头像/18px person、17/22px600中文标题；左16px/gap8px。右保留真实 capsule 边界+8px，失败回退112px。 |
| 搜索 | 独立 sticky 在实际 status+56px，下方4px/8px padding；44px高/r12/15px输入/左右40px，search20px，清空圆28px/close16px/right8px；surface90%与24px blur。受控 value、focus 和 bindinput 保留。 |
| 浏览正文 | 搜索后4px起始；主模块16pxgap；当前卡p12/r12，标题13/16px、主城市22/28px，手动标签11/14px/p2×8；帮助行mt8+pt4、13/18px。真实较长说明自然换行。 |
| 浏览说明/热门 | 说明卡p12/r12/gap8/原水平渐变、32px图圆/18pxFILL1；R1标签11/14px/p2×6全圆。热门17/22标题、13/18副字、44px四列按钮/12pxgap/r12/15px字，选中角点10px/-4px/2pxring与原30%蓝阴影。 |
| 全部城市 | 列表额外mt4px、内部12pxgap；字母头p4×12px/15/20px700；行48px高、左右12px、15/21px名字；独立1px分割线左缩12px右至卡边；badge和省份11/14px，省份700、当前已选600蓝。 |
| 搜索结果/空态 | 原搜索状态上下8px/min-height300px；准确place18px蓝与15/21px黑城市文字/gap4，拼音11/14px700 uppercase；空态取消原实现白卡，上下64px、44px location_off、17/22标题、13/18说明/4px顶部间距。原实现额外结果计数标题移除以对齐原稿；真实 query、结果过滤和选择仍复用。 |
| 底卡/页尾 | p16/r12/gap4、额外mt8/mb16、40px白圆/explore22px紫、17/22标题、13/18正文max270px；真实搜索按钮36px高/p12/13/16px/gap4/mt4。页尾48px+safe-area。 |
| 两层字母栏 | right4px、top实际status+144px、bottom80px；外p8×4/宽36px，内p4/gap4/65%白/blur12px；20px字母/11/14px700。外层不接收点击，只窄胶囊接收；层级低于头部和搜索。top加实际状态栏为微信平台适配。 |

标题仍为“选择城市”，城市状态仍为“当前浏览城市/手动选择/位置说明”，浏览说明保留 R1/邀请参与/公开同城未开放。底部仍执行真实搜索入口。原稿 GPS更新、142场雷达、Hot、自制选择延时toast以及已收申请toast没有真实R1来源，未创建这些能力。

## 精确 Material inventory

所有页内图形为 Material Symbols Outlined。固定官方 SVG 源版本：bd8cb85bd4bad964fe6918f79665bb40c3a8efef，wght400/opsz24/GRAD0；每个源散列、产物散列、名称、FILL、颜色、URL保存于页内 material-symbols-sources.json。固定SVG只改变root fill，轮廓路径逐字保留。源返回另有font-semibold600；本次固定源轴与最终网页字体渲染仍是未证实逐像素边界。

| 资产 | 准确名称 | FILL | 颜色 | 显示px |
|---|---|---:|---|---:|
| arrow_back_ios_new.svg | arrow_back_ios_new | 0 | #1a1b1f | 24 |
| auto_awesome.svg | auto_awesome | 1 | #5856D6 | 18 |
| check.svg | check | 0 | #1D64F2 | 18 |
| chevron_right.svg | chevron_right | 0 | #737687 | 18 |
| close.svg | close | 0 | #424655 | 16 |
| explore.svg | explore | 0 | #5856D6 | 22 |
| location_off.svg | location_off | 0 | #737687 | 44 |
| location_on.svg | location_on | 1 | #1D64F2 | 20 |
| more_horiz.svg | more_horiz | 0 | #1a1b1f | 22 |
| near_me.svg | near_me | 1 | #1D64F2 | 18 |
| person.svg | person | 0 | #ffffff | 18 |
| search.svg | search | 0 | #737687 | 20 |
| search_blue.svg | search | 0 | #1D64F2 | 16 |
| sync.svg | sync | 0 | #1D64F2 | 16 |
| place.svg | place | 0 | #1D64F2 | 18 |

原源 check_circle F0/lime18用于伪toast、add_circle F0/blue16用于伪申请按钮；因真实行为边界未放入产品。页内 search_blue.svg 是额外记录的真实“搜索更多城市”动作适配，不声称该动作与申请slot相同。

固定版准确 place_24px.svg 已由独立审计确认404。本次直接调用现有官方精确名字字体导出 helper：CSS请求 opsz24,wght400,FILL0,GRAD0&icon_names=place；唯一GSUB p,l,a,c,e → uniE0C8，960UPEM/static/Version2.972，使用 SVGPathPen + y-flip，未替换名称或编辑轮廓。CSS SHA-256：7fdb9247c2e13491f7e1c94200b9e6eda82e4029bc05632589771a2405d8ea22；字体 SHA-256：3e35970eca2b3c50e1546b36d25a4459ce42e12459e16c2155c298418a252dc7。这份字体来源独立于固定SVG commit。没有其他404或修改共享fallback proof。

## 必要 JS 变更

仅补充两个布局所需行为：

1. headerPaddingRight() 使用真实窗口宽度与 menu.left，保存/刷新 capsule+8px右保留值。
2. jumpToLetter() 仍校验原letters并使用原组id；有 selector geometry 时读取目标bounding rect、独立sticky搜索bottom和viewport.scrollTop，滚动到 max(0, oldScrollTop+target.top-sticky.bottom-4)，让字母标题处于实际停靠区域下方4px。缺少createSelectorQuery时保持原selector调用。几何数据不可用时不滚动。没有重做选择、查询、分组算法。

search/clearSearch/selectCity/locationHint/searchMoreCities/showCityInfo/goProfile/back 与基线函数文本逐字相同；statusBarHeight 和 groupsFor 也保持原算法。真实十个热门城市与A/B/C/D/G/H/N/S/W九组数据没有更改，受控旧值兼容仍由原工具处理。

## 本次验证

一次必要资源自检完成：

- WXML XML well-formed（校验仅把wx命名空间前缀规范化）、15个引用=15条manifest；
- 全部SVG XML/root颜色、源与产物SHA-256、固定SVG子元素路径逐字一致；
- FILL1仅near_me/location_on/auto_awesome；place字体/CSS散列、唯一glyph/axes/proof关联一致；
- eight原行为函数与基线函数文本相同，JSON与城市工具SHA-256仍等于独立审计。

内存中的原生几何行为harness通过三个窄场景：sticky下方4px的滚动计算（old300+target650-bottom156-4=790）、搜索后的不可见字母不跳转、负滚动值钳制0。胶囊样本width375/menu.left278产生105px，即实际97px+8px。这是行为计算证据，不是微信像素测量。

现有三份相关测试文件经捆绑Node执行：

    node --import tsx --test --test-concurrency=1 test/miniprogram-caper-city.test.ts test/miniprogram-caper-city-navigation.test.ts test/miniprogram-city-search-focus.test.ts
    tests 7 / pass 7 / fail 0 / skipped 0 / duration_ms 176.967708

首次裸node进程调用因当前工具PATH没有node而ENOENT；随后使用已定位的捆绑Node绝对路径运行，输出如上。不新增测试文件，不运行全量/业务/CI套件。现有navigation测试使用缺少geometry API的mock，覆盖原selector fallback；新增geometry分支由内存harness与根代理之后真实运行时检查共同限定。

## 文件散列与待根代理验证边界

| 文件 | bytes | SHA-256 |
|---|---:|---|
| miniprogram/pages/city/city.wxml | 5840 | 7cec49adfb88995cbc1a9fa69adf7376d7dabf2892b43410cd6260582c163c0d |
| miniprogram/pages/city/city.wxss | 9563 | 79fc9be6a07948f47530030194d098f4376cd183d629962ec7ffc362333bb361 |
| miniprogram/pages/city/city.js | 3791 | 271d93efcdadc8511751216f8e89459eac67640f5d27fa9371ee1776cb1506ae |
| miniprogram/pages/city/city.json | 143 | 1cab7364824fc6505717fe88931ec0d32fbaefdd6e417786ffff99485e70c499 |
| miniprogram/utils/city.js | 2537 | d8eacb0af597f946aaecae487097323eeba6323406c89aca4f0bd8f3df20c852 |
| miniprogram/pages/city/assets/material-symbols-sources.json | 8605 | 44814d81d20c1006a38a94b36f2b30f8b61171359c8ca67366e4d41214f703f4 |

City实现者未运行Git、微信CLI/SDK、Automator、CUA或编译/发布，未修改共享进度/矩阵。根代理仍需核对375px实际胶囊间隔、滚动后status/header/search、搜索chengdu/空态/清空focus、真实字母跳转组头可见、一次手动选择保存实际值并返回，以及说明/更多/头像/返回。字体轴/真机/正式GPS/正式发布均无本次验收结论。
