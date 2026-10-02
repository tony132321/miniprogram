# PG10-D / PG10-E 原稿视觉差异审计 · Wave 60（2026-10-01）

## 范围与证据边界

只读对照用户原 ZIP `/Users/tsb/Downloads/stitch_design_system_generator (2).zip` 的 `stitch_design_system_generator/pg10_d/{code.html,screen.png}` 与 `pg10_e/{code.html,screen.png}`。仅这两组原稿解压到 `/private/tmp/irl-ui60-profile-de-audit`；PNG 已直接查看。当前源码为 `miniprogram/subpackages/profile/privacy-safety/` 与 `legal/`。下表全部尺寸按 375px、1rpx=0.5px 换算；HTML Tailwind 的 rem 按默认 16px。原 PNG 两组尺寸比例不同，因此数值以 HTML 明确 token 为准，不把 PNG 原始像素直接当 375px 坐标。

本轮仅新增本文，没有实现、测试、模拟器复核或 Git 操作。结论是源码可确定的视觉差异，不是最新截图的逐像素验收。`docs/stitch-ui-parity.md:228-229` 的局部实点状态仍成立，不能升级为 1:1。已读 E111 `caper-pg10e-permissions-tab-wave47-2026-10-01.md` 与 E119 `caper-pg10d-block-revoke-identity-wave50-2026-10-01.md`：前者证明第四页签定位，后者证明真实空态与旧会话撤回门控，均不能覆盖以下视觉差异。

## 共用顶栏与字体

| 原稿明确值 | 当前来源与差异 | 可修复方向 |
| --- | --- | --- |
| 两页 header 内层 `h-14`=56px，侧距16px，返回触区44×44px，箭头24px；标题17px/22px、600；更多44×44px、图标22px；头像32px、person18px、背景#004cc8 | `common.wxss:2-5` 高46px、返回宽37px、文本‹24px，D标题16px/700，E `legal.wxss:6` 标题14.5px；D `privacy-safety.wxss:7-8`、共用`:9-10` 更多24×27px、头像27px，使用···和人字，背景#064dca | 页面局部恢复56px顶栏、44px触区、32px头像及原图标轮廓；中文真实页名可保留。原生胶囊避让由 JS 计算，不能直接抄浏览器顶栏最右坐标。 |
| Plus Jakarta Sans，Material Symbols Outlined；surface #faf8fe、on-surface #1a1b1f、variant #424655、outline #737687；正文按13/15px分层 | `app.wxss:1` 和 `common.wxss:1` 未设置原稿字体族；多处#171a24/#50586a/#858d9b近似色；emoji/Unicode代替轮廓图标 | 优先采用项目已有可用字体/本地矢量资源，检查中文回退字重；不要把外链字体加载成功当既定条件。原稿明确图标名可作为矢量轮廓依据。 |

## PG10-D（隐私与安全）

原 HTML 的布局关键行：hero `code.html:12-43`；列表标题/卡片 `:45-143`；空态 `:145-154`；底部举报 `:158-179`。

| 部位 | 375px 原稿 | 当前可确定差异（路径均为 privacy-safety/ 下文件） | 建议修复目标 |
| --- | --- | --- | --- |
| 页面画布/卡片 | 侧距16px→卡宽343px，header后首卡间距12px；卡radius12px；hero padding16px、白底加右上蓝色5%模糊圆 | `privacy-safety.wxss:2-3` 侧距20px→卡宽335px，header后margin13px；继承common:15 radius14px；`:13` 内距15.5/14.5/16.5px，0.5px边框和线性渐变 | 侧距32rpx、radius24rpx、hero padding32rpx，按原稿增加装饰圆；尺寸不依赖示例内容。 |
| hero标题组 | 40px圆、shield_with_heart 22px（填充）；间距8px；标题17/22px 600；副标题11/14px 700 | `wxml:9` ⊘；`wxss:14-17` gap10px，标题17px/21.25px 850，副标题11.5px/600；圆40px已经相近 | 恢复盾心图标、8px gap、17/22px与11/14px字级。保留现有真实机制副标题。 |
| 说明点列 | head下12px；首点没有额外行margin；行间8px；dot6px圆、gap8px、内容13px/1.625（约21.1px） | `wxss:18-20` 列表margin13.5px，所有子行再margin8.5px使第一行也下移；字符●8.5px，正文12px/18px，gap8.5px | 列表24rpx、仅后续行16rpx margin、12rpx CSS圆点，正文26rpx/1.625。真实三条规则可保留，行数不同不等于排版错误。 |
| 列表标题与间距 | hero与section之间16px；标题17/22px600，内部侧缩4px，count11/14px；列表/行之间8px | hero继承margin-bottom11px，加`:21` margin-top21px，存在多重间距；`:22-24` 标题15.5px/850、提示10px、count10.5px，行间7px | 用单一16px区段gap与8px行gap；标题34rpx/600，提示22rpx。不要显示未实现的“向左滑动”。 |
| 有记录行外形 | padding12px，gap8px；头像48px，右下16px粉红block徽标；姓名15/20px600；chip11/14px，日期13/18px；解除按钮min-height38px、水平14px、字13/16px600 | `wxml:18` 只有匿名⊘圆；`:29-35` padding11/9.5px，头像37.5px；姓名12.5px800、chip8.5px、meta9.5px、解除字10px，按line-height/padding约25px高 | 保留匿名头像占位与真实eventTitle；头像几何恢复96rpx、可加非个人数据block徽标；姓名30rpx、chip22rpx、meta26rpx、按钮min-height76rpx/字26rpx。不能植入虚构姓名、日期、原因和参考照片。 |
| 真实空态 | 原稿解除两条后为无白卡背景的居中空态，padding纵40px、绿64px圆verified_user32px，标题17px、描述13px | `wxml:17` 当前白色pg10-card；`:25-27` padding27px、◌23.5px蓝、全部主文12px、描述10px | 可按原空态几何恢复绿圆与两级字体，保留“暂无屏蔽记录”及真实描述。LOADING/ERROR/登录态属于必要扩展，不照搬隐藏假列表。 |
| 举报卡 | 与列表区间为外层16px gap＋aside12px margin；padding12px、report_problem18px/32px圆、gap8px；正文13px/18px、链接13px/16px600 | `wxss:39-43` 上margin27.5px还叠加上一卡bottom7/11px，padding12.5px、圆33px/叹号17.5px、两行字11px | 用结构gap控制间距，替换三角警示轮廓，恢复26rpx文字；保留直接真实举报入口与安全提示。 |

PG10-D 的两张图片原源为 HTML 两个 `lh3.googleusercontent.com/aida-public/` avatar URL（`AB6AXuAdqjMf0Um...`、`AB6AXuAJcP7Tw2...`）；它们绑定虚构被屏蔽成员，不能作为当前账号个人资料。源图标包括 arrow_back_ios_new、more_horiz、person、shield_with_heart、block、verified_user、report_problem、arrow_forward、check_circle。原 PNG 的 hero 图标显示不完整，但 HTML 明确指定 shield_with_heart；采用完整原轮廓时应注明是 HTML 恢复，不声称复制 PNG 缺字点。

## PG10-E（当前服务说明）

原 HTML：sub-context/meta `code.html:12-54`；四页签 `:56-75`；正文卡片自`:77`开始。该页没有照片资源，使用相同字体与 Material 图标。

| 部位 | 375px 原稿 | 当前差异（legal/ 下文件） | 可修复目标 |
| --- | --- | --- | --- |
| 容器/节奏 | 侧距16px；文档卡间12px；radius12px；正文padding16px | `legal.wxss:3,7,30` 侧距14px、间距7.5px、radius11px、padding11.5px | 32rpx侧距、24rpx卡间/radius、32rpx正文padding。内容不同造成总高度不同应保留。 |
| 顶部状态chip | label11/14px600、左右8px上下2px，行内gap4px；字号/分享32px圆18px Material符号 | `:8-16` chip9px700、水平6px上下3px、gap5px，Aa文字10px/800、分享手绘11×10px | 保留“当前服务说明/正式协议待核定”，恢复22rpx标签/正确内距/图标轮廓。32px控制本身已吻合；分享继续原生open-type。 |
| 摘要结构 | 白卡padding12px，顶层生效日与阅读时间行；下方gradient内层padding8px/radius8px、28px圆auto_awesome16px，标题13/16px、正文13/18px | `wxml:5` 直接一层kicker+标题+段落；`:18-23` padding11px、23.5px圆角方块✦、kicker8.5px、标题12.5px、正文10px；缺内层渐变框 | 可恢复两层卡片及28px圆星光图标。版本、生效日、认证未批准，不能复制；顶层可放真实待核定状态/中性阅读信息，须避免编造日期与认证。 |
| 页签形状/字级 | 胶囊轨道rounded-full、padding4px、gap4px；按钮pill，字13/16px600、水平12px/纵6px，按内容宽度自然排布 | `:24-25`轨道radius8px、button radius6px、font9.5px、min-width85px、height27.5px、水平7.5px | 轨道/按钮全圆角、26rpx字/32rpx行高、24rpx水平内距；移除硬最小宽度即可更接近原稿横滑节奏。维持真实四入口。 |
| 正文标题/编号/标签 | 编号圆32px、17/22px600；标题17/22px600；标题组gap8px；标签11/14px600、8px/2px内距 | `:31-39` 圆21.5px、编号11.5px800、标题11.5px800、gap5px、标签8.5px700 | 编号64rpx、字号34rpx/44rpx；标题同字级；标签22rpx/28rpx与正确内距。标题长时允许正常换行。 |
| 正文/信息子卡 | 主段落15px、leading-relaxed约24.4px；子卡padding12px、radius8px、body13/18px、icon18px（联系方式/定位为24px有色圆＋14px白图标） | `:45-47` 主文10px/16.3px；子卡9.5px/14.25px、padding7.5/8.5px、icon11.5px Unicode | 恢复主文30rpx/1.625、子文26rpx/36rpx、padding24rpx/radius16rpx。依实际段落使用本地group/chat/location/check等轮廓，避免通用字符◎⌖⊙代替。 |
| 请求处理卡 | padding16px、40px蓝圆shield20px；标题17/22px、副文13/18px；渐变白→surface→soft-blue；下方邮件行 | `:48-51` padding11.5px、22.5px蓝圆◇13.5px、标题11px、描述9.5px，纯浅蓝底；没有邮件行 | 恢复40px盾图标、17/13px层级及渐变。邮件/48小时承诺未正式提供，缺邮件行是服务边界，不能伪造官方联系。 |
| 底部操作/安全区 | sticky bottom0，侧padding16px、glass背景/blur/上阴影、gap8px；两按钮等宽48px高、15/20px600；foot11/14px | `:52-56` 普通文档流无sticky/glass、gap5px、高37.5px、字号10.5px800、flex0.9:1.35不等宽、foot9px | 恢复底栏外形、96rpx按钮高度、30rpx字、等宽及safe-area。禁用PDF和真实请求入口保持；不要变成“确认同意”。实施后须注意sticky容器与长文滚动，并把JS:38的92rpx header offset改为与实际高度一致。 |

## 必须保留的真实行为与差异分类

- D `privacy-safety.js:21-41` 等账号ready、真实GET `/me/blocks`，LOADING/UNAUTHENTICATED/ERROR/READY；`:45-70` 当前列表会话校验、POST `/me/blocks/:id/revoke`、处理中禁用及真实结果。匿名名称、真实eventTitle、空列表和“可逐条管理”属于真实能力差异，不是恢复假数据的理由。
- D `:74-90` 返回调用backToProfile；个人及登录按钮切换`/pages/me/me`；顶部帮助`/subpackages/profile/support/support`、说明`/subpackages/profile/legal/legal`；举报置`irlProfileFocusIntent=reportSection`并生成当前actor reportContext后切换我的。不要将举报恢复为客服alert或假聊天。
- E `legal.js:16-24` 返回backToProfile、原生公开页分享载荷、Aa切换；更多到公约`/subpackages/profile/guidelines/guidelines`、本地存储`/subpackages/profile/cache/cache`、我的`/pages/me/me`。`:25-41`权限说明定位`#legalPermissionsSection`且避开顶栏；`:43-48`请求按钮以`profileFocus=privacySection`切换我的。恢复视觉不应替换这些目的地。
- E 正式V4.2、认证、生效日、第三方清单、位置检索与联系方式交换、相册服务、立即匿名化与7日销毁、DPO邮箱/48小时、PDF下载和同意状态均缺正式依据或未实现。保留现有真实说明、未发布禁用态、六号工程权限卡与请求人工核查边界；它们与原稿内容/卡片数量/高度不同不能列为纯视觉缺陷。

优先批次：先两页局部字级/原色/边距/卡片圆角；再D空态、匿名行几何和图标；再E摘要两层结构、全圆页签与操作栏。顶栏改动须同步权限定位offset，避免视觉修复引入原已验证导航回归。本文未声称以上修复已完成。
