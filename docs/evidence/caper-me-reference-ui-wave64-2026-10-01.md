# Wave64 我的核心组件原稿恢复证据

日期：2026-10-01。实现范围：`miniprogram/pages/me/me.wxml`、`me.wxss`、页面本地 `assets/`。基线为 root 提供的 `d66bdba36e3028aff2e833d6aa9973be3713da37`。本文件记录原稿／源码／资源自检，微信运行测量与路由检查由 root 在独立复审后执行；本记录不构成真机、服务部署、全39屏或整页逐像素通过。

## 原稿与尺寸口径

完整读取 `caper_1/code.html` 和对应 PNG，并读取现有完整 WXML、WXSS、JS、`app.wxss` 与页面 JSON。原稿 HTML SHA-256 `37088f60630a26b0c2711c9ef018076d3ede9128cf33e5b7bf399fb66217faf9`；PNG SHA-256 `8901eb5958e4ecb9a209d40992c0214e5e6b1d89b99a64b5eabea22df6bbb369`，PNG 为212×1600缩小长图。HTML `main` 的390 CSS px是原稿布局基准，不以212图宽推算尺寸。

新核心 token 保留原 CSS px 字面值；页面宽度为原生窗口 `100%`，左右16px。原生状态栏绑定 `statusBarHeight`，核心 sticky header 为56px，右侧继续绑定现有 `headerPaddingRight()` 计算的实际胶囊留白。没有将新 px 乘2转换为rpx。旧高级区继续原有单位与样式；页级左右边距16px随原生窗口适配。

| 组件 | 当前有效源码值 | 来源／边界 |
| --- | --- | --- |
| 品牌／动作 | logo28、play16、中文16／英文10、设置／扫描按钮32及glyph20、动作gap12 | 原HTML103–137；原生56px header属于平台适配 |
| 个人卡／头像 | p16／r24；avatar64、border2、white ring2；heading20/900、handle12/mt4、caption12/mt8 | 原HTML139–172；“我”和“我的空间”是诚实无照片身份占位，保留现有登录状态文案 |
| 四统计 | 4等列、gap8、mt20／pt16、主数18、label10／mt2 | 原HTML172–196；保留“我的活动／发起组局／确认报名／站内通知”真实表达式及加载时破折号 |
| 核心章节 | font14、marker6×14、link12、mt20／mb10、chevron14 | 原HTML199–205／244–250／274–278／344–352；只给核心4个head增加 `me-core-section-head` |
| 勋章 | 4列／gap8、p10／r16、emoji盒40／emoji20、title12／copy9 | 原HTML209–238；🏸／👑／⚡／🤝对应原emoji，四项仍“待开放”，没有奖励或等级断言 |
| 兴趣 | chip12、p6×14、gap8 | 原HTML254–271；标签与不能添加／保存的说明保持 |
| 真实授权 | card p14／r16、行间gap14、glyph盒32／SVG16、标题12、说明10 | 原HTML279–339；按原HTML `text-xs` 确认标题12px。两类当前授权全文自然换行，原样本微信群／历史公开开关不被当作业务 |
| 本人活动 | 2列／gap10、p8／r16、photo96／r12、title12／meta10；filters12／p4×12／gap8 | 原HTML355–431；当前真实title/date/status、示意配图、异常／空态保留，日期装饰改为原emoji📅 |

头像在线绿点已从 WXML 与CSS移除，原稿Léo照片、在线状态、Lv.3以及LV3/MAX/TOP/99+样本均没有进入当前用户事实。完整真实授权说明取消原有两行截断，提交中、说明更新、结果不确定、重核按钮和不可操作条件保留。原生 `<switch>` 继续现有绑定，scale(.85)为原生控制适配，不声称其内部像素等于原HTML自绘switch。活动“示意配图”和真实状态标识属于诚实数据适配，没有增加样本人数或好友。

原稿font family为系统sans链，核心区域使用原 `-apple-system/BlinkMacSystemFont/SF Pro Text/PingFang SC/Helvetica Neue/sans-serif` 声明。没有下载字体；当前设备实际字体与字形仍待原生测量。窄原生窗口活动筛选可自然换行，源390窗口的固定4项文字用当前真实关闭文案。

## 原 SVG 提取

原HTML共32个inline SVG，包含公共底栏。本批提取8个页面SVG变体，实际7种几何；对应10个原稿节点，WXML静态image引用10处。源photo隐私入口与公共导航不计入本批。

`assets/source-manifest.json` 保存原HTML／PNG hash、源SVG序号／完整节点／行号、每个原节点hash、颜色和规范化SVG hash。仅规范化SVG根：去除Tailwind class、`viewbox`→`viewBox`、添加xmlns与原CSS width/height、将根currentColor解析为源有效颜色；子XML字节、路径和stroke不改。设置／扫码stroke-width=1.8，其他按源stroke；同几何的蓝／灰chevron保留各自源颜色。行号取当前匹配原HTML字节，和旧审计中的范围描述可能不同。

| 资源 | 源序号 | 原HTML行 | 源有效颜色 | 原尺寸 | SVG SHA-256 |
| --- | --- | --- | --- | --- | --- |
| `brand-play.svg` | 1 | 108–110 | `#c6ff00` | 16px | `4bb07851610ea4a98f73fbc931850d04f895e80e9caa8930d67202055ea943fe` |
| `settings.svg` | 2 | 122–125 | `#334155` | 20px | `1b6f5d17074da1ce714b4d98939709f98e5e4b749afff06290b70211a464ad57` |
| `scan.svg` | 3 | 128–131 | `#334155` | 20px | `0e935db4d22a403f92a09eb4dbbe6513f90961dadb20f4d47b03e2126859ca1d` |
| `chevron-blue.svg` | 4 | 205 | `#1d64f2` | 14px | `05d932abc55313a80d26445f3a961d60802ec60de8ba27b5a3f976bcacda5e0f` |
| `privacy-reminder.svg` | 6 | 283 | `#1d64f2` | 16px | `a7a19bbff5a29712131038d155db446a26748698e7c8691291bd416138f9c398` |
| `privacy-invites.svg` | 7 | 300 | `#059669` | 16px | `347e0f24aa8a7277c4ef8ff8ecbc1454b71056d5b0ae4283fa799e1a8868d84e` |
| `privacy-blocks.svg` | 10 | 331 | `#475569` | 16px | `316f62d5f19fd1e0789c2a2a6e7a23b1221c670be5299ec89a18e1d8eb539b4b` |
| `chevron-muted.svg` | 11 | 337 | `#94a3b8` | 14px | `e7d1e88552bf50d5a3c7f1e544cea2421cad607193545ef5496d122b2e306111` |

## 业务与高级区域保护

全页111个具有业务属性的节点逐序核对：`wx:*`、全部id、bind/catch、data-*、disabled、checked、value、aria-label均与修改前一致；140个动态表达式按多重集合核对完全保留。两个consent开关及其条件、loading/uncertain/reconfirmation/retry文案和会话边界保持；活动同ID详情和现有关闭态入口绑定保持。

`advancedOpen`内部至帮助区之前的原WXML字节完全一致，保留所有安全／申诉／隐私／举报表单、焦点anchor与操作。87个既有高级区、共享`.card`及长页样式selector的声明序列完全一致。新圆角／padding只作用于 `.me-core-card` 和限定核心类。其他长页模块没有视觉复刻结论。

`me.js` 与修改前快照逐字节一致，SHA-256 `def9a36a9c46deca17cebbe95e5bd8672469eea6e759fd279b45d28c9f87021b`。`revealAdvanced`仍以status+76定位，恢复header56px后保留20px可见余量，没有触碰会话、授权和提交算法；实际focus可见性留给root定向实测。

## 一次必要自检

使用指定绝对Python，单次合并执行：源HTML／PNG hash及PNG维度；32源SVG计数、8资产XML、路径／子XML逐字节与清单hash；10静态refs存在；完整WXML XML解析（绑定表达式用确定性占位后解析）；111业务节点属性与140动态表达式；advanced字节与87保护style selector；新增核心规则无rpx；真实占位／勋章关闭态；JS字节hash及绝对Node `--check`。结果 **PASS**，WXML元素337个。临时输出 `/private/tmp/irl-wave64-me/selfcheck.json`。

本任务没有执行全量测试、业务写操作、微信CLI／SDK／CUA、共享矩阵或Git操作。独立复审及root的有界微信检查仍待执行：header／胶囊、源几何与SVG、设置、扫描说明→行程、勋章、兴趣、一个真实活动同ID详情，以及必要的授权焦点可见性。

## 冻结文件 SHA-256

| 文件 | SHA-256 |
| --- | --- |
| `miniprogram/pages/me/me.wxml` | `6b9348f72e03f955bb8c19b6c3996270eeb52d19bdcc76134a53c200eb9f2a7f` |
| `miniprogram/pages/me/me.wxss` | `c090c16406ddcb5b85f5cea37c5fc8581df0a5f7907b23c6f423daec2e37fb7d` |
| `miniprogram/pages/me/me.js` | `def9a36a9c46deca17cebbe95e5bd8672469eea6e759fd279b45d28c9f87021b` |
| `miniprogram/pages/me/assets/brand-play.svg` | `4bb07851610ea4a98f73fbc931850d04f895e80e9caa8930d67202055ea943fe` |
| `miniprogram/pages/me/assets/chevron-blue.svg` | `05d932abc55313a80d26445f3a961d60802ec60de8ba27b5a3f976bcacda5e0f` |
| `miniprogram/pages/me/assets/chevron-muted.svg` | `e7d1e88552bf50d5a3c7f1e544cea2421cad607193545ef5496d122b2e306111` |
| `miniprogram/pages/me/assets/privacy-blocks.svg` | `316f62d5f19fd1e0789c2a2a6e7a23b1221c670be5299ec89a18e1d8eb539b4b` |
| `miniprogram/pages/me/assets/privacy-invites.svg` | `347e0f24aa8a7277c4ef8ff8ecbc1454b71056d5b0ae4283fa799e1a8868d84e` |
| `miniprogram/pages/me/assets/privacy-reminder.svg` | `a7a19bbff5a29712131038d155db446a26748698e7c8691291bd416138f9c398` |
| `miniprogram/pages/me/assets/scan.svg` | `0e935db4d22a403f92a09eb4dbbe6513f90961dadb20f4d47b03e2126859ca1d` |
| `miniprogram/pages/me/assets/settings.svg` | `1b6f5d17074da1ce714b4d98939709f98e5e4b749afff06290b70211a464ad57` |
| `miniprogram/pages/me/assets/source-manifest.json` | `1fef1e21fc1599a1b4f83119dd05becc06a6c2a7a86e82fdd8e1fdd37c88b4ba` |
