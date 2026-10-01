# PG02-LOC 城市选择原稿差距审计（Wave 63，2026-10-01）

本报告为下一批城市页的独立只读审计。已完整读取原稿 `code.html`（544行）、用 `view_image` 查看原 `screen.png`，并核对现有城市页 WXML、WXSS、JS、JSON、城市工具、全局样式和既有官方符号来源记录。只新增本报告；没有修改产品、Git、模拟器、原稿或资源，没有运行测试、编译、发布。官方资源 HTTP 只读请求在内存中核验，未保存或下载到工作区。

## 来源、散列与测量边界

原稿目录：`/private/tmp/irl-stitch-original/stitch_design_system_generator/pg02_loc_city_selection/`。原 PNG 为 **219×1600** 的纵向导出图；不能把其压缩后的像素距离当作375px设备 CSS尺寸。以下原尺寸由完整 HTML 的明确 Tailwind token 得出，当前 WXSS 的 `rpx` 按 **375px窗口、2rpx=1px** 换算；尚无 Wave 63 微信运行时测量。

| 文件 | 字节数 | SHA-256 |
|---|---:|---|
| 原 `code.html` | 41951 | `3806ef705727d39e89ce8ddcde8ef46539e16d78624cee1fbf8425962bf690e5` |
| 原 `screen.png` | 80554 | `e716caf0d8cee09aafa3468f7d78a7454d019116732b04ae8e71f39b8a9aae9b` |
| `miniprogram/pages/city/city.wxml` | 4215 | `a57877d0da14f35f92efc1bfcd42452a8a704b41950e08efd4b6d3e0c31233ca` |
| `miniprogram/pages/city/city.wxss` | 6987 | `61055b270ef8455a3ad78733f6ae674457864982c45724325f8a2ac078f0a970` |
| `miniprogram/pages/city/city.js` | 2654 | `f2ea7ad6e11a7976e20fc432618864a7143ef89abfdf114dd276bdb258be46f0` |
| `miniprogram/pages/city/city.json` | 143 | `1cab7364824fc6505717fe88931ec0d32fbaefdd6e417786ffff99485e70c499` |
| `miniprogram/utils/city.js` | 2537 | `d8eacb0af597f946aaecae487097323eeba6323406c89aca4f0bd8f3df20c852` |

PNG 已确认相同排列：头部、搜索、当前城市卡、雷达说明、热门四列、A/B/C/D/G/H/N/S/W九组、底部找不到城市卡及右侧字母栏。当前十个热门城市、九组主列表和北京/成都标签已按此稿建立；本批应恢复图形和布局，复用现有数据及真实交互。

## 头部、状态栏、胶囊与搜索停靠

原 `code.html:16` 是 `fixed top-0 inset-x-0 z-50` 头部，`pt-safe` 加56px行，正文 `pt-14`。当前 WXML:2 状态栏占位处于普通流，WXSS:4 `.city-nav` 也处于普通流，**滚动后两者消失**。已有 About 页提供局部可参考的56px sticky头部、固定状态栏底色与实际胶囊避让。

| 项目 | 原稿明确值 | 当前375px换算／源行 | 可做的局部几何 |
|---|---|---|---|
| 头部行／底色 | 56px；`surface #faf8fe` 85%、blur24px；shadow `0 1px 8px rgba(0,0,0,.03)` | 48px；96%底色；shadow `0 1px 5px rgba(28,41,61,.025)`，WXSS:4 | 112rpx行；sticky在 `statusBarHeight` 下；显式固定状态栏底色、`pointer-events:none`，正文保持正常占位。 |
| 头部左右／元素间隙 | 左右16px、gap8px；返回左负4px | 左11px、右100px、gap4px，WXSS:4 | 原左32rpx/gap16rpx；右側用实际微信胶囊+8px保留区，不把网页右16px照搬到胶囊下。 |
| 返回触区／图形 | min44×44px、图24px；**justify-start**；margin-left -4px | 32×34px、字符 `‹` 26px，WXML:4/WXSS:7 | 88×88rpx触区、48rpx官方图形、左对齐；保留 `back`。 |
| 更多触区／图形 | min44×44px、图22px；margin-right -4px | 26.5×32px、字符 `···` 15.5px，WXML:6/WXSS:9 | 88×88rpx、44rpx官方图形；保留 `showCityInfo` 真实说明弹窗。 |
| 头像／图形 | 圆32px、背景 `primary #004cc8`、person18px；左4px | 圆27px、同背景、字符 `♙` 15.5px，WXML:7/WXSS:10 | 64rpx圆、36rpx person、左8rpx；保留 `goProfile`。 |
| 标题 | 17px/22px600、-0.01em；flex1+truncate；原词为 `Edit Profile` | 中文“选择城市”13.5px650；absolute left35/right80px，WXML:5/WXSS:8 | 保留准确中文标题，恢复34/44rpx600，flex1/min-width0/ellipsis；原词是导出模板标题差异，不改页用途。 |
| 搜索外层 | `sticky top-0 z-30`、左右16px、上4px/下8px、surface90%、blur24px | 无sticky/独立外层底色；`.city-content` 上5px/左右16px，WXSS:11–12 | 独立sticky外层，底色90%/模糊；**微信top应在状态栏+56px头部下方**。原网页top0在滚动时可能被z50头部遮挡，不能照抄重叠。 |
| 搜索输入 | 44px高、radius12px；字15px/21px；左右40px；search距左12px | 高44px/radius11px；字12.5px；容器左右11px、gap6.5px，WXSS:12–14 | 高88rpx、radius24rpx、字30/42rpx，原输入左右80rpx；搜索图40rpx，左24rpx。保留value/focus/bindinput。 |
| 清空按钮 | 圆28px、right8px、close16px；底 `surface-variant #e3e2e7` | 圆21px、字 `×`17px、底 `#d8d9df`，WXSS:15 | 56rpx圆、32rpx close、right16rpx、原底色；保留 `clearSearch` 及其已有焦点恢复。 |
| 输入聚焦样式 | focus白底、blue12% shadow `0 4px 16px` | 没有同类视觉样式 | 可局部恢复focus视觉；不要重新设计焦点状态或输入逻辑。 |

胶囊参考已实时读取 `miniprogram/pages/about/about.js:1–9`：`wx.getMenuButtonBoundingClientRect()` 的 `left` 与当前 `windowWidth` 计算 `Math.ceil(width-left+8)px`，失败时 `112px`。城市页当前仅固定 `padding-right:200rpx`，宽度和原生胶囊变化没有适配。实际状态栏来源 `city.js:17–22` 已存在，应复用；只补头部布局所需的数据，保留选择/搜索逻辑。扩大触区后需量标题、按钮、胶囊是否重叠。

## 正文几何、字级与配色

原根底色与当前均为 `#faf8fe`，原页边16px和当前32rpx已匹配。以下对齐不要求照搬原稿的虚构GPS/活动统计，也不要求用原长图高度填充正文。

| 项目 | 原 HTML明确值 | 当前375px换算 | 局部恢复目标 |
|---|---|---|---|
| 主浏览流 | search之后mt4px；块间gap16px | current顶部9.5px、tip顶部10px；标题另独立17px顶距 | 使用原4px流起始与16px模块间隔；热门内部独立8px标题/网格间隔。 |
| 当前城市卡 | padding12px、radius12px；shadow `0 4px 20px -2px rgba(28,41,61,.05)` | padding11×12px、radius11px；shadow `0 4px 13px rgba(28,41,61,.045)` | 24rpx padding/radius与原阴影；保持当前浏览城市文字。 |
| 卡顶标签／位置说明 | label13px/16px600、gap4px；near_me18px／sync16px | 标签11px700、gap3.5px；mark14px／说明10.5px，WXSS:17–19 | 26/32rpx600、8rpxgap、36/32rpx两图。 |
| 当前城市主字／主行 | 22px/28px700、主行mt12px；城市与标签gap4px | 21.5px800、line1.2、mt7.5px、gap6px，WXSS:20–21 | 44/56rpx700、mt24rpx；标签间8rpx。 |
| 手动状态标签 | 原GPS标签11px/14px700、p2×8px、圆全；green `#34C759`／底 `#EBF9F0` | 手动标签9.5px、p2×5.5px、green `#1f9a49` | 保留“手动选择”，22/28rpx字，padding4×16rpx与原颜色。 |
| 当前城市右圆 | 32px浅蓝圆／20px F1 location_on | 28px圆、`⌖`15px，WXSS:23 | 64rpx圆／40rpx准确F1图。 |
| 当前帮助行 | mt8px+pt4px；13px/18px、outline `#737687`、gap4px；绿点6px | mt9px无独立pt；字9.5px/12.825px、gap4.5px、点5px，WXSS:24–25 | 16rpxmt+8rpxpt；26/36rpx、gap8rpx、点12rpx。当前真实说明较长，可换行，记录是R1文案适配，不强行隐藏事实。 |
| 雷达/浏览说明卡 | p12px、radius12px、gap8px；to-right蓝软→紫软→白 | p9px、radius10px、gap7.5px、100deg渐变，WXSS:26 | 24rpx p/radius、16rpxgap，原水平渐变；保留“IRL城市浏览/R1/邀请参与”文字。 |
| 雷达图圆／主副字 | 圆32px、F1 auto_awesome18px；13/16px600、13/18px；右chevron18px outline | 圆29px、字符17px；11.5px750、9.5px；右字符15px `#858998` | 圆64rpx、图36rpx；字26/32rpx600、26/36rpx副字、右图36rpx `#737687`。 |
| R1小标签 | 原Hot11/14px700、p2×6px、圆全、粉底/粉字 | R1 7.5px、p1×2.5px、radius2.5px，WXSS:30 | 保留R1内容，22/28rpx、p4×12rpx、圆全；不恢复Hot统计含义。 |
| 热门标题／副字 | 17/22px600与13/18px outline；标题和grid gap8px | 14px750、9.5px `#858998`、底距7.5px，WXSS:33–34 | 34/44rpx600、26/36rpx `#737687`、gap16rpx。 |
| 热门四列按钮 | 44px高、gap12px、radius12px、15/20px600；宽 `(容器-36px)/4` | 高41.5px/gap6.5px/radius9.5px/字11.5px650；宽 `(容器-19.5px)/4`，WXSS:35–36 | 高88rpx、gap24rpx、radius24rpx、字30/40rpx600；宽 `(100%-72rpx)/4`，十城市/选中绑定不改。 |
| 热门active／角点 | blue30% `0 4px 16px` shadow；点10px、right/top -4px、ring2px surface | blue23% `0 4px 10px`；点7px、偏移-1.5px、边1.5px，WXSS:37–38 | 恢复shadow；点20rpx、偏移-8rpx、ring4rpx。 |
| 全部列表标题／组间 | 列表mt4px，内部gap12px；17/22px标题 | list-heading顶21px，组底11.5px，WXSS:39–40 | 原流gap16px+列表mt4px；组/标题间24rpx；不要把独立margins重复叠加。 |
| 字母组卡／字母头 | radius12px；p4×12px；字15/20px700，背景 `#f4f3f8` | radius11px；高23.5px/p左右11.5px；字11px800，WXSS:40–41 | radius24rpx；p8×24rpx，字30/40rpx700；字母头由文字+padding成为28px高。 |
| 城市行／城市字 | 48px高、width100%、左右12px；15/21px400 | 44px高、左右margin10px、内部width减20px、字12.5px，WXSS:42–45 | 96rpx高、full-width、左右24rpxpadding、字30/42rpx；城市数据/顺序不改。 |
| 行分割线 | 单独1px线，左缩12px、右到卡缘；`#efedf3` | 0.5px border-bottom跟随行，左右各10px缩进 | 2rpx线/左24rpx；可伪元素或独立view，只改样式，保持最后一行无线。 |
| 城市badge／省份 | badge11/14px700、p2×6px、圆全；省份11/14px700 outline；已选blue600 | badge8.5px/p1.5×4px/radius4px；省份9.5px `#858998`，WXSS:47–51 | badge22/28rpx、p4×12rpx、圆全；省份22/28rpx700/`#737687`，已选600蓝。 |
| 城市字/标签/勾gap | 4px；check18px F0blue | gap4.5px；字符10.5px800 | gap8rpx、check36rpx；不重建currentCity选择状态。 |
| 底部找不到城市卡 | p16px、radius12px、内部gap4px、mt8px/mb16px；正文max270px | p14/10/16px、radius12px、mt13px、文字无max-width | 原32rpxp/24rpxradius、8rpx内部gap、16rpxmt/32rpxmb；真实手动偏好文字保持。 |
| 底部图圆／主副字 | 40px白圆、explore22px紫；17/22px600、13/18pxoutline | 30px白圆、`◎`15px蓝；12.5px750、9.5px，WXSS:57–59 | 80rpx圆、44rpxexplore `#5856D6`；34/44rpx600、26/36rpx，正文max540rpx。 |
| 底部真实搜索按钮 | 源申请按钮36px高、p左右12px、13/16px600、gap4px、mt4px | 搜索按钮23.5px高、p左右10px、9.5px700，WXSS:60 | 72rpx高、24rpx左右、26/32rpx600、gap8rpx、mt8rpx；保持“搜索更多城市”+`searchMoreCities`，不恢复申请假toast。 |
| 正文页尾 | 内层pb48px+safe；底卡另mb16px | 页尾28px，无safe-bottom，WXSS:2 | 恢复96rpx尾距+safe-area；应按实际内容和滚动证据记录，不补虚构运营块。 |

## 字母栏：20px、4px间隔、top144／bottom80

原 `code.html:392–404` 的外围 `aside` 为 `fixed right4px top144px bottom80px z40`，flex列居中、p上下8px/左右4px。内部胶囊 p4px、`gap4px`、白65%/blur12px、shadow `0 2px 10px rgba(0,0,0,.06)`；九个字母各20×20px、11/14px700、`#424655`。因此内部胶囊宽28px、高220px（九格180px+八gap32px+上下8px），外围宽36px，字母位于受top/bottom限定的区域中央。

当前 `.alphabet-rail`（WXSS:61–62）把外层/胶囊合在一层：right2px、top45%、translateY(-20%)、p3.5×1.5px、白78%、z5；每按钮14.5×14.5px、无gap、8.5px600。其位置随整屏百分比变化，无法保持原144/80几何。

可局部恢复两层：外栏right8rpx、top288rpx、bottom160rpx、flex居中、p16×8rpx；内胶囊p8rpx/gap8rpx、65%白底/blur24rpx；字母40×40rpx、22/28rpx700。原网页无微信状态栏，若top需加状态栏，应明确记录成 `statusBarHeight+144px` 的平台适配；不要无记录混用百分比。外栏应低于header/search层，触区仅覆盖右侧栏，避免遮挡主列表或胶囊。

九个字母的现有 `letters`、`data-letter`、`jumpToLetter`（city.js:47–50）复用。加sticky头与搜索后，`wx.pageScrollTo({selector})` 的组顶可能进入遮挡区：需要在本页窄范围证据中确认目标字母头可见，再决定是否只补新布局所需滚动偏移；不用重做城市数据、焦点或返回行为。

## 全部精确 Material 名称、FILL、颜色与显示尺寸

源为 **Material Symbols Outlined**，共14个静态span+脚本生成2个span。F0指源没有显式FILL设置的默认0，F1指源显式 `'FILL' 1`。大小为CSS图形框/字号，不能用SVGpath黑色包围盒代替。源返回另有font-semibold600；当前仓库已有官方资源管线为wght400/opsz24/GRAD0，不能据此声称所有字体轴逐像素一致。

| 原HTML行／精确名字 | FILL | 源颜色 | 显示px | 当前目标／差距与边界 |
|---|---:|---|---:|---|
| 16 `arrow_back_ios_new` | 0 | on-surface `#1a1b1f` | 24 | `.nav-back` 字符 `‹`；原左对齐、44px触区。 |
| 16 `more_horiz` | 0 | on-surface `#1a1b1f` | 22 | `.nav-options` 字符 `···`；保留现说明弹窗。 |
| 16 `person` | 0 | on-primary `#ffffff` | 18 | `.nav-profile` 字符 `♙`；源32px primary圆。 |
| 20 `check_circle` | 0 | vibrant-lime `#D2F803` | 18 | 原自制toast图。现选择立即back/系统toast，没有同一自制toast；只记录，不为图形重写反馈或计时器。 |
| 28 `search` | 0 | outline `#737687` | 20 | `.search-icon` 字符 `⌕`。底部真实搜索动作若用search16px蓝，是明确R1语义适配。 |
| 32 `close` | 0 | on-surface-variant `#424655` | 16 | `.search-clear` 字符 `×`；源28px `#e3e2e7`圆。 |
| 46 `near_me` | **1** | electric-blue `#1D64F2` | 18 | `.location-mark` 字符 `⌖`；可恢复原图形，保持“当前浏览城市”，不宣称定位。 |
| 50 `sync` | 0 | electric-blue `#1D64F2` | 16 | `.relocate-hint` 字符 `↻`；可恢复装饰，保持“位置说明”与`locationHint`，无GPS请求。 |
| 64 `location_on` | **1** | electric-blue `#1D64F2` | 20 | `.current-pin` 字符 `⌖`；不要复用profile-edit已有的F0 location_on。 |
| 75 `auto_awesome` | **1** | party-violet `#5856D6` | 18 | `.tip-orb` 字符 `✧`；不要复用about已有的F0同名文件。 |
| 84 `chevron_right` | 0 | outline `#737687` | 18 | `.tip-arrow` 字符 `›`/当前 `#858998`；不能换arrow_forward_ios。 |
| 322 `check` | 0 | electric-blue `#1D64F2` | 18 | `.city-check` 字符 `✓`10.5px；源是独立18px准确图形。 |
| 379 `explore` | 0 | party-violet `#5856D6` | 22 | `.missing-icon` 字符 `◎`/当前蓝；源40px白圆。 |
| 386 `add_circle` | 0 | electric-blue `#1D64F2` | 16 | 原“申请开拓新城市”图。现真实“搜索更多城市”并非该申请slot；只记录源，不恢复申请能力/已收申请toast。 |
| 485 动态 `location_off` | 0 | outline `#737687` | 44 | `.empty-icon` 字符 `⌖`31px；源空结果图没有白卡圆。 |
| 502 动态 `place` | 0 | electric-blue `#1D64F2` | 18 | `.search-city-name` 字符 `⌖`与城市名合并染蓝；源place图蓝18px、城市文字15px/21px `#1a1b1f`，图文gap4px，拼音11/14pxoutline且**uppercase**。精确place来源见下。 |

搜索态源结果容器为左右16px/上下8px、min-height300px；内部白卡radius12px、结果行48px、左右12px；无结果内容为上下64px居中、44px图、17/22px标题、13/18px说明、图底8px/说明顶4px。当前仍显示额外“搜索结果/计数”标题，并把empty作白卡、上下30px，当前搜索结果城市名全蓝、拼音未uppercase。可恢复原字级/图文/空态几何；现额外结果计数若保留应记录为R1适配，无需改搜索语义。

## 官方资源路径与只读网络核验

固定源根（沿用既有项目管线）：`https://raw.githubusercontent.com/google/material-design-icons/bd8cb85bd4bad964fe6918f79665bb40c3a8efef/symbols/web/`。下表URL路径均相对此根；2026-10-01本次逐个GET只读核验。15个HTTP200正文在内存中计算散列，1个准确路径HTTP404。既有缓存根为 `/private/tmp/irl-material-symbols-wave60/`，有缓存项逐字散列与HTTP正文一致。

| 精确官方相对URL路径 | HTTP | 源正文 SHA-256／缓存情况 |
|---|---:|---|
| `arrow_back_ios_new/materialsymbolsoutlined/arrow_back_ios_new_24px.svg` | 200 | `24883e73bfab266fa35e91ae4f014c72ad858c4d7ab0ee51a9a171616dacd43f`；已有缓存。 |
| `more_horiz/materialsymbolsoutlined/more_horiz_24px.svg` | 200 | `498ade89fbbdd4f4ab9b90bb49bae4cc6b2dc0ff0f019b6b051ac641a7bd5872`；已有缓存。 |
| `person/materialsymbolsoutlined/person_24px.svg` | 200 | `42f1c6f70aaea6be1bce078d1bd3bdc027a343943827443fe3ea46320b9dac96`；已有缓存。 |
| `check_circle/materialsymbolsoutlined/check_circle_24px.svg` | 200 | `42bf0950bc12ecf7952a8c3be86e0131f225095a7dc6c824a659a13df442e373`；已有缓存。 |
| `search/materialsymbolsoutlined/search_24px.svg` | 200 | `46d4ab85eba6eb4fe7c9a9a4c4db2fdf8fa9cc74c1f398ac72e7d872d490dd4c`；未缓存。 |
| `close/materialsymbolsoutlined/close_24px.svg` | 200 | `a82592b0faa0b104a4d4b0530bb05c6a4bfed5728f5aad03ae8e7a19f32b5511`；已有缓存。 |
| `near_me/materialsymbolsoutlined/near_me_fill1_24px.svg` | 200 | `26382a2a7f676d202b149a95bc74cb823ef9421b85c3a9e7aa3cbd5d2eae6768`；未缓存。 |
| `sync/materialsymbolsoutlined/sync_24px.svg` | 200 | `1b47b89b3d9dde46cf7d2329286f95ddcfa7f060dabc740f22169c53c72f624c`；未缓存。 |
| `location_on/materialsymbolsoutlined/location_on_fill1_24px.svg` | 200 | `d8de5d6f89d0a65d23e97b9a74393ee56a83a21b65a0a93de39aa5ccf781107c`；未缓存。 |
| `auto_awesome/materialsymbolsoutlined/auto_awesome_fill1_24px.svg` | 200 | `21d265301babb4e8c5669ec8edac2194ff612bd6ee90be8676e2835bf78c8bff`；已有缓存。 |
| `chevron_right/materialsymbolsoutlined/chevron_right_24px.svg` | 200 | `f6b777ee0ce9059b5f8eea987d813ab12c4f309ba431063153841c742e668ac0`；已有缓存。 |
| `check/materialsymbolsoutlined/check_24px.svg` | 200 | `01edd53418816632be08e9565b8ca40d9028c230a8a67baaf4b8a1de20db00e6`；已有缓存。 |
| `explore/materialsymbolsoutlined/explore_24px.svg` | 200 | `7ab282089cf6a23d151de17cdc53cc0f0744af913364e772dad3e35015cb67f3`；未缓存。 |
| `add_circle/materialsymbolsoutlined/add_circle_24px.svg` | 200 | `b68e8939e124cfd4d7608f32e2422db033b2c6ef393308e78c4e6e9a4b779b0f`；已有缓存。 |
| `location_off/materialsymbolsoutlined/location_off_24px.svg` | 200 | `63fbcc906aa76b0172816d2e1fe16c65fc5bf3eef2d51314f6707960ddfa2fae`；未缓存。 |
| `place/materialsymbolsoutlined/place_24px.svg` | **404** | 无该固定版文件；**不能静默换名location_on**。 |

本地主包 About 的 `assets/{arrow_back_ios_new,more_horiz,person}.svg` 已是精确F0/正确颜色，逐字散列与各自manifest的assetSha256一致，可供city资源布局参考。`miniprogram/subpackages/profile/cache/assets/auto_awesome.svg` 已是F1紫、`profile-edit/assets/chevron_right.svg` 已是F0outline，但它们是分包文件；城市页位于主包，建议按相同来源另放 `miniprogram/pages/city/assets/`，不让城市页形成对profile分包资源的加载依赖。`profile-edit/assets/location_on.svg` 为F0，不能用于本稿F1；`close.svg`和`check.svg`颜色也不同，应只按manifest源取得原path后改root fill，不改轮廓。

### place 的精确官方字体路径

只读请求 [Google Fonts准确place子集](https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&icon_names=place)，字节留在内存，没有写字体文件：

- CSS SHA-256：`7fdb9247c2e13491f7e1c94200b9e6eda82e4029bc05632589771a2405d8ea22`。
- CSS指向字体URL：`https://fonts.gstatic.com/l/font?kit=kJF1BvYX7BgnkSrUwT8OhrdQw4oELdPIeeII9v6oDMzByHX9rA6RzaxHMPdY43zj-jCxv3fzvRNU22ZXGJpEpjC_1v-p_4MrImHCIJIZrDCvHOemdd8az0VAqb8d395kBgQ&skey=b8dc2088854b122f&v=v374`。
- 字体2032bytes，SHA-256 `3e35970eca2b3c50e1546b36d25a4459ce42e12459e16c2155c298418a252dc7`；static，Version2.972，960UPEM，**没有fvar**，请求轴opsz24/wght400/FILL0/GRAD0。
- 按cmap字符序列 `p,l,a,c,e` 查GSUB，准确完整ligature只匹配一枚 `uniE0C8`，可以按这个名字导出；不是根据相似外形选location_on。
- 用当前已存在临时FontTools的 `SVGPathPen` + `TransformPen(1,0,0,-1,0,0)` 只读描出该字形，path字符串长706，SHA-256 `e71dff61f23ee1bceaf5ebc50a95fd1aa4c5a3c74618766def380ff9ad19a1aa`。

已有 `/private/tmp/irl-material-symbols-wave60/export_font_symbol.py` 可参考精确GSUB/来源保存流程，但其输出路径assert限制在profile分包，**不能直接用于主包city**。后续实现需把CSS、字体源字节与source.json作为独立字体证据保存，并给city生成自己的manifest；该字体来源与固定SVG commit应分别记录。审计未导出产品资源。

## R1 行为保持与下一步窄验证

`city.js:28–45` 的当前城市读取、受控城市校验、`irlSelectedCity`本机保存和立即返回已存在；`utils/city.js`保留旧版可选城市兼容逻辑。搜索仍接受名称/拼音/省份，清空仍回到主列表并恢复focus，底部仍滚到搜索框，字母仍使用既有九组，头像/更多/返回仍绑定真实页面或说明。这些无需为原稿UI重新实现。

原网页GPS上海、900ms伪重新定位、雷达142场、Hot、600ms选择toast返回、申请已收到toast都没有R1真实服务来源。保留当前“当前浏览城市/手动选择/位置说明/公开同城未开放/搜索更多城市”语义；几何恢复和装饰图形不能转成真实定位、活动密度或已收申请声明。原网页头 `Edit Profile` 不改当前中文标题。

根代理实现后仅需针对城市页补窄证据：375px下56px头/44px返回更多/32px头像/实际胶囊间隔，滚动后的状态栏+头部+搜索不遮挡，热门44px+gap12，城市行48px/15px字，字母20px+gap4与144/80定位；搜索`chengdu`、无结果、清空focus、字母跳转后组头可见、位置说明/更多/头像/返回。选择存储只做现有行为回归，不重复全量测试，不把源码或模拟器证据提升为真机/正式发布/真实GPS验收。
