# PG10-C / PG10-F / PG10-G 视觉差距审计 — Wave 58

日期：2026-10-01。审计时仓库 HEAD：`7c6355d`。

## 范围与尺寸口径

本次逐页查看原 ZIP 的 PNG、HTML，当前 WXML / WXSS / JS，以及已归档的微信工具截图。输出供下一批三页外观修复使用；本次只写本证据文档，没有修改产品、测试或共享矩阵，没有操作模拟器或执行测试。

- 原设计输入：`/Users/tsb/Downloads/stitch_design_system_generator (2).zip`。只按页解压六个 `screen.png` / `code.html` 到 `/private/tmp/irl-pg10-visual-audit57/`，解压文件不是待提交代码。
- 原 PNG 尺寸分别为 PG10-C **482 × 1600**、PG10-F **780 × 1600**、PG10-G **524 × 1600**；本次选用的当前截图均为 **580 × 1260**。画布宽高比、状态栏和当前展开状态不同，不能直接把原始像素坐标相减作为一致性结论。
- 下表“原设计”取原 HTML 的 CSS / Tailwind token，`1rem = 16px`；“当前”同时列源码 rpx 和按 **375px 页面宽度**换算的逻辑 px，换算为 `rpx × 375 / 750`。其他页面宽度应按实际宽度换算。
- 原稿统一字体 token：`headline-sm = 17px / 22px`，`body-md = 15px / 21px`，`body-sm = 13px / 18px`，`label-lg = 15px / 20px`，`label-md = 13px / 16px`，`label-sm = 11px / 14px`，`display-mobile = 28px / 36px`；空间 token `margin = 16px`、`space-lg = 16px`、`space-md = 12px`、`space-sm = 8px`、`space-xs = 4px`。
- 下文为来源可核对的外观差距和源码按钮目标，**没有宣称三页或 39 屏逐像素通过**，也不代替同设备的新截图与点击验证。

## 原素材与当前截图

| 页 | ZIP 内原素材路径 | 本次查看的当前截图 |
| --- | --- | --- |
| PG10-C moments | `stitch_design_system_generator/pg10_c/screen.png`、同目录 `code.html` | [正常本人活动卡](images/caper-pg10c-from-chat-2026-10-01.png)；[Wave 57 旧会话分类清理](images/caper-pg10c-stale-filter-wave57-2026-10-01.png)对应不同状态，不能用于判断正常活动卡照片布局 |
| PG10-F cache | `stitch_design_system_generator/pg10_f/screen.png`、同目录 `code.html` | [Wave 48 存储刷新](images/caper-pg10f-refresh-wave48-2026-10-01.png) |
| PG10-G support | `stitch_design_system_generator/pg10_g/screen.png`、同目录 `code.html` | [Wave 46 第四项 FAQ 展开](images/caper-pg10g-faq-wave46-2026-10-01.png)；原 PNG 四项均收起，所以不比较 FAQ 卡整体高度 |

本机原素材缓存路径分别为：

- `/private/tmp/irl-pg10-visual-audit57/stitch_design_system_generator/pg10_c/`
- `/private/tmp/irl-pg10-visual-audit57/stitch_design_system_generator/pg10_f/`
- `/private/tmp/irl-pg10-visual-audit57/stitch_design_system_generator/pg10_g/`

## 共用头部

当前三页仍保留返回、更多入口、个人页入口和微信原生胶囊避让；避让不能为了模拟原 PNG 被删掉。

| 当前 selector / 位置 | 当前值，375px 口径 | 原设计值 / 来源 | 差距与修复约束 |
| --- | --- | --- | --- |
| moments `.moments-header-avatar`；cache `.profile-header-avatar`；support `.pg10-header-avatar` | 内容为字面“人”；`54rpx` 圆径 = **27px** | 原 `w-8 h-8` 圆径 **32px**，内部白色 Material `person` 轮廓 | 最直观的占位图标差异。可替换为本地轮廓图标，保留 `goProfile` 和无障碍标签；扩大圆径时检查胶囊避让 |
| 三页 `.pg10-header` | `92rpx` = **46px** | 原头部内容区 `h-14` = **56px** | 当前更紧凑；需在同设备和胶囊避让下复核，不能把额外原生状态栏当成外观缺陷 |
| `.moments-header-more`、`.profile-header-more`、support `.pg10-header-more` | `48rpx × 54rpx` = **24 × 27px** | 原更多按钮 `min-w-[44px] min-h-[44px]` | 点击目标比原稿小；可以扩大命中区域，但保留现有菜单与胶囊预留宽度 |

源码：[共用头部样式](../../miniprogram/subpackages/profile/common.wxss)，[moments](../../miniprogram/subpackages/profile/moments/moments.wxml)，[cache](../../miniprogram/subpackages/profile/cache/cache.wxml)，[support](../../miniprogram/subpackages/profile/support/support.wxml)。

## PG10-C — 本人活动记录 / moments

当前源码：`miniprogram/subpackages/profile/moments/moments.wxml`、`moments.wxss`、`moments.js`。正常截图可见真实本人活动、活动状态、三图示意布局、关闭提示和底部发起按钮。

### 布局、间距与字号

| 当前 selector | 当前值，375px 口径 | 原设计值 / HTML 来源 | 判断 |
| --- | --- | --- | --- |
| `.moments-page` | 左右 `24rpx` = **12px** | `px-margin` = **16px**；原 HTML 12、31、59 行 | 页面外边距小 **25%**；原图有更宽边缘留白 |
| `.moment-card` | 内距 `20rpx` = **10px** | 卡头、照片内侧、页脚 `p-space-md` / `px-space-md` = **12px**；63、83、116 行 | 卡内距小约 **16.7%** |
| `.moment-title` | `26rpx` = **13px** | `headline-sm` = **17px / 22px**；69 行 | 标题字号小约 **23.5%** |
| `.moment-meta` | `19rpx` = **9.5px** | `body-sm` = **13px / 18px**；70 行 | 元信息字号小约 **26.9%** |
| `.moment-symbol` | 圆径 `52rpx` = **26px** | `w-8 h-8` = **32px**；65 行 | 类别圆标小 **18.8%** |
| `.moments-filter` | 字号 `21rpx` = **10.5px**；侧 padding `21rpx` = **10.5px**；上下 `10rpx` = **5px**；间距 `8rpx` = **4px** | `label-md` **13px / 16px**；`px-3.5` **14px**；`py-1.5` **6px**；`gap-space-xs` **4px**；12–27 行 | 当前筛选胶囊文字、侧内距偏小；保留横向滚动和真实筛选 |
| `.summary-icon` / `.summary-title` / `.summary-note` | 圆径 **27.5px**；标题 **12.5px**；说明 **9.5px** | 圆径 **40px**；标题 **17px**；说明 **13px**；36–44 行 | 摘要内部视觉层级偏小；其 `min-height:160rpx` 和真实两行说明已有专项依据，不能因恢复原字号而删除关闭态说明 |
| `.photo-large` | 宽 `66%`、高 `550rpx`；在当前 375px 页宽及内距下约 **218.5 × 275px**，宽高比 **0.794** | 左图 `col-span-8`、`aspect-[4/5]` = **0.8**；83–85 行 | 主图比例已接近原稿；不应优先把固定高度当成大的比例错误 |
| `.photo-small`、`.photo-stack` | 单图高 `228rpx` = **114px**；当前内宽约 **109px**，宽高比约 **0.956**；间距 `7rpx` = **3.5px** | 两张 `aspect-square` = **1:1**；间距 **4px**；96–107 行 | 次图并非正方形，建议按比例排版，使不同宽度下稳定；保留实际详情导航 |
| `.moments-action` | 未声明固定高度；继承字号 `27rpx`，`line-height:2.8`，标称行框约 **37.8px** | 底部 CTA 显式 `h-[52px]`；284 行 | 原 CTA 高 **52px**。当前实际按钮高度还受原生按钮盒模型影响，修复前后需同设备量测；必须保留安全区位置与末尾留白 |

### 图标与配图

- 原筛选图标分别为 `auto_awesome`、`groups`、`crown`、`camera_roll`，当前使用 `✧`、`♧`、`♛`、`▤`。摘要原为 `photo_camera_front`，当前为 `▧`；底部原为 `photo_camera`，当前也为 `▧`。这些占位字符可以替换成对应的本地轮廓图标。
- 当前 `eventIllustrations()` 为羽毛球选择其他页面的三张本地素材：`/assets/stitch/pg01_badminton_player.jpg`、`/assets/stitch/itinerary_badminton.jpg`、`/assets/stitch/caper_home_badminton.jpg`。正常截图主图为逆光剪影，次图为双人打球和比赛动作。
- 原 PG10-C 首卡 HTML **86、99、107 行**分别引用室内跃起扣杀、赛后朋友合影、计分板细节的 `lh3.googleusercontent.com/aida-public/…` 图片；图片说明和完整 URL 保留在 ZIP 的 `pg10_c/code.html`。原 PNG 对应三图与当前明显不同，尚未有这些 PG10-C 原照片已本地化的证据。
- 如果下一批复用原场景素材，图片仍属于设计示意图。应保留“示意配图”“活动相册未开放”以及无障碍说明，不恢复原 `+21`、照片计数、上传者、点赞评论数字或虚构野餐 / 桌游活动。

### 实际按钮目标与关闭状态

| 当前入口 | 源码行为 / 目标 | 外观修复必须保留 |
| --- | --- | --- |
| 返回 / 头像 / 更多菜单 | `backToProfile`；`goProfile` → `/pages/me/me`；更多可进 `/subpackages/profile/privacy-safety/privacy-safety`、`/subpackages/profile/guidelines/guidelines`、我的页面 | 现有返回路径、菜单和胶囊避让 |
| 全部 / 我参与的 / 我主办的 | `selectFilter` 过滤 `/me/events` 结果；参与条件为本人 `CONFIRMED` 报名，主办条件为 `isHost` | 真实活动与当前身份检查；Wave 57 旧身份清理 |
| 配图整体 / 活动详情 | `openActivity` 校验当前身份和可见活动，再进 `/pages/event/event?id=…` | 图不是可用相册入口；原稿相册动作不能恢复成假的上传或照片查看 |
| 底部 / 无活动时发起 | `goCreate` → `/pages/create/create` | “发起新活动”是当前真实目标；“照片上传待开放”是必须的能力披露 |
| 胶片合影 / 打包 / 点赞评论 / AI 找图 | 当前为关闭态说明；AI 不采集或比对人脸 | 保留关闭态，不把原 `LIVE`、回忆率或社交计数当成待恢复的数据 |

## PG10-F — 本地存储 / cache

当前源码：`miniprogram/subpackages/profile/cache/cache.wxml`、`cache.wxss`、`cache.js`。当前结构与原稿同为存储总览、说明卡、安全提示、主动作；数据含义已按实际原生能力调整。

| 当前 selector | 当前值，375px 口径 | 原设计值 / HTML 来源 | 判断 |
| --- | --- | --- | --- |
| `.storage-page` / `.storage-summary` | 页面侧距 **15px**；卡内距约 **14–14.5px** | 页面 **16px**；总览卡 `p-space-lg` = **16px**；15 行 | 间距接近，优先级低于字体和图标 |
| `.storage-size` | `35rpx` = **17.5px**，数字与 `MB` 使用同字号 | 原数字 `display-mobile` **28px / 36px**，单位 `label-md` **13px / 16px**；26–28 行 | 数字小 **37.5%**，主读数层级不足。原稿数字 / 单位分开排版；若修复，需从同一实际读数拆显示，不能硬编码容量 |
| `.storage-heading` | `26rpx` = **13px** | `headline-sm` **17px / 22px**；23 行 | 标题小约 **23.5%** |
| `.storage-bar` | `16rpx` = **8px** | `h-3` = **12px**；33 行 | 条高小约 **33.3%**；当前单一真实使用占比不能改成假分类分段 |
| `.storage-stat-label` / `.storage-stat-value` | **9.5px** / **12.5px** | `label-sm` **11px** / `label-lg` **15px**；44–60 行 | 总览下方指标偏小；三列仍使用已用、上限、占比 |
| `.storage-info-icon` | 圆角方框 `62rpx` = **31px** | `w-10 h-10` = **40px**；87、112 行 | 图标框小 **22.5%**；原 `photo_library` / `forum` 与当前数据说明含义不同，替换图形需继续描述真实内容 |
| `.storage-protection-icon` | `◇`，字号 `30rpx` = **15px** | 绿色 `verified_user` 盾牌，**20px**；138 行 | 轮廓形状明显不同；可用盾牌图标，但不得恢复无依据的“清理绝不丢失”保证 |
| `.storage-refresh` | 高 `78rpx` = **39px**；字号 **12.5px** | 主 CTA `h-12` = **48px**；`label-lg` **15px**；145 行 | 高度小 **18.8%**；原清理扫帚可替换为表达当前刷新动作的图标 |

其他占位图标：`.storage-symbol` 为 `▤`，原 `storage`；`.storage-diagnosis-icon` 为 `▣`，原为 `auto_awesome`。当前“设备存储状态”没有 AI 诊断能力，不能随图标恢复在线 / 智能安全推荐状态。

按钮与状态来源：

- `refreshStorage()` 实际调用 `wx.getStorageInfoSync()`，把 `currentSize` / `limitSize` 的 KB 换算为 MB，计算使用占比；异常会显示 `UNAVAILABLE`，读数为 `--`。
- “管理账号与数据请求”调用 `goPrivacy()`，设置 `profileFocus = 'privacySection'` 后进入 `/pages/me/me`。`miniprogram/pages/me/me.js` 会接收该焦点，`me.wxml` 存在 `privacySection`。
- 更多菜单可进入 `/subpackages/profile/legal/legal`、本人数据请求或我的页面；返回使用 `backToProfile`。
- 原稿清理项目选择、全选、清理确认弹层没有当前真实能力依据。保留“暂无安全清理分类”“此页不提供一键清理”“数值不代表可清理容量”的披露，以及真实最近读取时间。原 12.4 / 8.6 / 3.8 MB、142 个封面、语音分类和最近清理时间不能当作待恢复的像素内容。

## PG10-G — 帮助与反馈 / support

当前源码：`miniprogram/subpackages/profile/support/support.wxml`、`support.wxss`、`support.js`。当前截图第四项 FAQ 已展开；比较闭合行尺寸与表单几何，不把展开答案导致的整体高度增加当成差距。

| 当前 selector | 当前值，375px 口径 | 原设计值 / HTML 来源 | 判断 |
| --- | --- | --- | --- |
| `.support-page` / `.support-hero` | 页面侧距 **15px**；hero 内距 **16px** | 页面 **16px**；hero 内距 **16px**；13 行 | 基本接近，优先级低 |
| `.support-hero-actions button` | 高 `78rpx` = **39px**；字号 **10.5px**；无前置动作图标 | `h-10` = **40px**；`label-md` **13px**；前置 `chat` / `support_agent` **18px**；34–40 行 | 高度接近，文字和图标偏差更明显；禁用状态必须保留 |
| `.support-faq-trigger` | 字号 `24rpx` = **12px**；行高 **16.8px**；上下 padding **10px**；单行盒高度约 **36.8px** | 标题 `body-md` **15px / 21px**；`py-3` = **12px**；单行约 **45px**；56–58 行 | 字号小 **20%**，闭合行高度小约 **18.2%**；最明确的可修密度差距 |
| `.support-tags` / `.support-tag` | 字号 **10.5px**；侧 padding **9px**；gap **5px**；高度 **26px** | 字号 **13px / 16px**；`px-3.5` **14px**；gap **8px**；`py-1.5` **6px**，高度约 **28px**；116–129 行 | 当前截图五标签一行，原 PNG 为 **3+2 两行**。可先按这些原数值恢复，保留“违规举报”独立真实按钮 |
| `.support-textarea` | 盒高 `156rpx` = **78px**；字号 **11px** | 原 `rows="4"` × **21px** 行高，外包 `p-space-sm` **8px**，总约 **100px**；140–141 行 | 当前描述框小约 **22%**；原行数推算不是新模拟器量测 |
| `.support-upload-placeholder` | 方框 `141rpx` = **70.5px**；图标 `▧` | `w-20 h-20` = **80px**；`add_photo_alternate` 图标 **26px**；152–154 行 | 方框小约 **11.9%**，图形不同；上传继续关闭 |
| `.support-contact` | 高 `77rpx` = **38.5px**；图标 `▣`；输入字号 **11px** | 字号 **15px / 21px**、上下 padding **10px**，约 **41px**；`contact_phone` **20px**；162–164 行 | 文字和图标更明显，输入继续禁用 |
| `.support-submit` | 高 `83rpx` = **41.5px**；字号 **13px**；没有 send 图标 | 高 **48px**；`headline-sm` **17px**；`send` **20px**；169–171 行 | 高度小约 **13.5%**；可以恢复尺寸与图形，保留禁用色和“暂未开放” |

按钮与状态来源：

- 四项 FAQ 标题与顺序已对应原稿。`toggleFaq` 校验索引后切换单项展开；第四项的“发起受控活动”调用 `goCreate()` → `/pages/create/create`。
- 反馈类型“违规举报”和下方安全求助按钮均调用 `goReport()`，设置 `irlProfileFocusIntent = 'reportSection'` 及当前身份上下文，再进入 `/pages/me/me`。`me.js` 接收焦点，`me.wxml` 存在 `reportSection`。
- AI 提问、人工客服、textarea、联系方式和提交按钮均明确禁用；其余建议分类为静态展示。普通建议没有发送接口，不能为了接近原图而改成假选中 / 假提交成功。
- 更多菜单进入 `/pages/about/about` 或我的页面；返回使用 `backToProfile`。
- 必须保留当前 FAQ 对真实付款 / 退款、认证和自动责任判定的边界说明；不恢复原稿自动扣信用分、原路退款、自动调解等无依据行为。
- “平均 3 秒响应”、机器人在线绿点、09:00–22:00、`IRL_Support_Team` 和普通反馈成功 toast 没有当前服务依据。保留“暂未开放”、不会收集 / 发送表单内容、客服渠道尚未公布、真实举报入口等披露，不将这些必要文案差异记为待修像素缺陷。

## 下一批最小修复顺序与复核边界

**三页上述视觉差距仍待修复。** 本批交付为审计依据；下一目标轮次可直接按表中 selector 与原 CSS 尺寸实施。

1. **PG10-G FAQ / 标签尺寸**：按表恢复字体、padding、gap 和闭合行高度。这两个差距原 HTML、原 PNG、当前源码与截图同时支持；不改 FAQ 答案或路由。
2. **三页占位图标**：先替换头像“人”和明显的 `▧` / `▣` / `◇`，使用本地轮廓图形，保留点击绑定、无障碍说明和能力关闭状态。缓存 / 客服图标需表达实际语义。
3. **PG10-F 主读数和 CTA**：恢复数字与单位的层级、条高和按钮高度，继续使用原生实际读数与刷新动作。
4. **PG10-C 留白、标题与次图比例**：恢复外边距 / 内距及文字层级；照片可再安排原素材本地化，继续明确示意性质。

实施后需要针对改动页复拍相同页面宽度、滚动位置、身份和 FAQ 展开状态；验证胶囊避让、底部安全区、标签换行、长标题截断与现有真实按钮目标。以上是下一批的验证要求，本次没有执行或记录新的模拟器通过、运行测试或更新验收矩阵。
