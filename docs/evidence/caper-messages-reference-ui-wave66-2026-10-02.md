# CAPER 消息 INBOX 原稿恢复：Wave 66

日期：2026-10-02。范围来自 `docs/superpowers/plans/2026-10-02-messages-idea-visitor-reference-ui.md` 的任务 A。沿用现有真实 R1 通知、筛选、分页和路由，只改 `messages.wxml`、追加 INBOX 专属 `messages.wxss` 与两张原稿 SVG。本报告仅记录来源与源码检查；微信原生渲染和点击由 root 在最终同步后验收。

## 1. 完整输入与来源

已阅读完整 `caper_3/code.html`、完整现有消息页 WXML/WXSS、对应业务 JS 和本轮计划，并查看完整 `screen.png`。这份 HTML 的 viewport 是 390 CSS px；290 × 1600 PNG 是长页缩小导出，尺寸取 HTML 的明确 class/CSS，不从缩小图片反推。

| 来源 | 字节 | SHA-256 |
| --- | ---: | --- |
| `/private/tmp/irl-stitch-original/stitch_design_system_generator/caper_3/code.html` | 32,137 | `18fab22c6b92592673e19574739eb2ed86cbfb0fe628023ec5dcd3b843a1aa6b` |
| 同目录 `screen.png` | 210,560 | `85fc42cb05ea57b3afe81c594917572ead3122dfa5feb958595574fb5901da1b` |

原 ZIP 与解压输入的同字节关联已在 Wave 65 输入盘点中记录：`docs/evidence/caper-next-reference-gap-audit-wave65-2026-10-02.md`。本轮未重新下载或生成设计。

## 2. 恢复的局部结构与明确尺寸

| 原稿区域 | 当前恢复 |
| --- | --- |
| 整体 header | brand、title、3 filters 包在同一 sticky 容器中，原横向 padding 20 px、底部 8 px；white/white/`#f8fafc` 渐变 |
| 品牌 | 32 × 32 px 蓝色圆、白色“耍”18 px；中文 12 px、英文 9 px，gap 6 px；按原 font weight、tracking 和蓝色阴影 |
| 工具按钮 | 两个 32 × 32 px 圆形按钮，gap 8 px，原 inline SVG 显示 16 × 16 px；原搜索与设置绑定不变 |
| 标题 | 24/32 px、weight 900、tracking -.025em；真实未读数 12/16 px、padding 2 × 8 px；副标题 11/16.5 px、顶部 2 px |
| 贴纸 | 蓝色 11 px、padding 2 × 8 px、-3°；黄色 10 px／末行 9 px、padding 4 × 8 px、3°，使用原 custom shadow `2px 4px 12px rgba(0,0,0,.06)`；三行按原结构排列 |
| 三筛选 | 真实 ALL / ACTIVITY / SYSTEM 保留；font 12/16 px、vertical padding 6 px、gap 8 px、顶部 16 px、底部 4 px；不复制原静态活动未读红点 |
| 未读优先卡 | 横向 16 px 卡片 inset；padding 12 px、radius 16 px、border 1 px；heading 横 padding 4 px、底部 8 px |
| 真实通知行 | padding 8 × 4 px、gap 12 px；标识 40 × 40 px、未读 badge 16 × 16 px；title 12/18 px、time 10/15 px、summary 12/18 px；保留真实 tone、kind、类别、ellipsis |

新原稿尺寸按 CSS px 字面值写入。旧 `26rpx` 仅留在两处抵消已有页面外层 gutter：header 的负 margin 与优先卡的 `calc(16px - 26rpx)`。长页其他模块的原有 gutter 不改；本轮没有宣称整个长页正文都已转换为原稿 16 px。

原 `py-0.2`、`shadow-2xs` 并非这份 Tailwind v3 的已定义 token，本轮没有猜测 padding 或创造阴影。真实通知标识继续显示现有通知图标与 tone，不复制 Coco、阿杰、静态时间或虚构聊天数据。

## 3. 微信原生状态栏／胶囊适配

沿用未修改的 `messages.js` `onLoad`：实际 `statusBarHeight`，以及 `max(96, ceil(windowWidth - capsule.left + 8))` 的 `capsuleInset`，无可用系统数据时维持已有 24/96 回退。

- 原 HTML 的 9:41、状态图标与底部系统导航不复制；既有原生状态 shield 只在 INBOX 为白色。
- 整个 header sticky 的 `top` 绑定实际 `statusBarHeight`，brand/control 行为本轮计划明确的原生 56 px 适配。
- brand 的内联右 padding 是 `calc({{capsuleInset}}px - 20px)`。容器已有 20 px 右 padding，两者相加等于原 helper 的完整 inset，防止重复计入外边距；控制区以胶囊左边界前至少 8 px 为基准。
- `CENTER` 与 `CHAT_UNAVAILABLE` 不带 `messages-inbox` 根类；其已有状态、胶囊、返回和布局结构保持。

这部分是源代码几何适配证据，实际 capsule、sticky 行为、小屏按钮边界仍需 root 的有限微信原生检查。

## 4. 精确原 SVG 资产

只增加两张应用 SVG，合计 **965 B**。来自用户原稿 header 中相应 `aria-label` 的完整 inline SVG，均无字体轴或字体依赖。

| 资产 | 原 HTML 行 | 字节 | 资产 SHA-256 |
| --- | ---: | ---: | --- |
| `miniprogram/pages/messages/assets/search.svg` | 81 | 207 | `aeff8942a1a5a1a87f6f8dadfccba80d47d758084cc333270b360caef617c302` |
| `miniprogram/pages/messages/assets/settings.svg` | 84 | 758 | `2f20e16cc351312cb34aa489af483fac0aac754687a8044f214a1b784c54e8ec` |

| 图形 | 原完整 SVG SHA-256 | 原／当前 child XML 同字节 SHA-256 |
| --- | --- | --- |
| search | `a8f249f49b351dbf2fef218580f2b7d4edb99365d728f3d15f1b305efef14611` | `2290cb772d8252c8f07c3bc1def3e48cbd95e8479a51e03044024d7eebf95603` |
| settings | `d8cec11b1177b094d3b96d0c0ec28e80f433870494c3b4a6202265348b25e181` | `a2ec2532f4b989db33be93fee45ee818dd7eec250fa17c311765d63967da0707` |

仅独立 SVG root 做规范化：添加 `xmlns` 与内在 24 × 24 px；删除网页 class；`viewbox` 正确写为 `viewBox`；`stroke="currentColor"` 按原父按钮 `text-slate-700` 解析为 `#334155`。保留 `fill="none"`、`stroke-width="2"`、原 `viewBox="0 0 24 24"`，全部 path/circle 的 child XML 字节相同。没有新 path、坐标变换、镜像、Material／Phosphor 替代、字体下载或重复照片。

来源为用户提供的设计包；包内未附此 inline SVG 的单独外部许可证声明，本报告不推定 MIT 或其他许可。

## 5. 一次必要源码检查

2026-10-02 使用本地绝对 Python 运行一次来源／资源／绑定／保护区域联合检查，**exit 0**，输出 `SOURCE/BINDING/PROTECTED CHECK PASS`。未运行业务测试、全量测试、CI、SDK、微信 CLI 或 computer use；未操作 Git 或总验收矩阵。

检查证据：

- WXML 元素嵌套完整；95 个业务属性节点的顺序和属性序列未变。属性范围包括 `wx:*`、`bind*`、`catch*`、`data-*`、`id`、`disabled`、`value`、`placeholder`、`aria-label`；序列 SHA-256 为 `059cbadc4fa119a4029f6ef0f02e96de7fbc0d1dd1c3e418433115849b91ee01`，与修改前相同。
- `messages.js` 30,759 B 与修改前完全同字节。真实 priorityItems 仍取未读记录前两条，priorityCount 与 unreadTotal 来自已有真实数据，所有通知路由与筛选逻辑未改。
- 原 WXSS 前 **28,676 B** 完全保留，前缀 SHA-256 为 `d7f5eb1d60c43aba966ff87e2967af26ec6a87d5149435cfc953a4d8afb2b058`。新增 **39 条 CSS rules** 全部以 `.messages-inbox ` 开头，仅匹配本轮 header/status shield/priority 局部目标。
- 两张 SVG XML 可解析，root 参数准确，child XML 对应原图同字节；各资源在 WXML 引用一次，目录只含这两张资产。

| 未改 WXML 区域 | 修改前／后同字节 SHA-256 |
| --- | --- |
| search、错误／登录／加载／空态、审核、真实消息动作、会话未开放提示（search 至 priority 前） | `0503be16a19a0f047d0546e620b09765adf82cfcecbc2abe95d2db55e0670e07` |
| noticeGroups、加载更多、AI／提及未开放、gallery、slogan、settings、长页 footer | `c3cc02f06246bbb61022c83bbdac044fed1099bde7c3f29b51cc93cb57e20129` |
| CHAT_UNAVAILABLE、CENTER 至文件结尾 | `2bd31b9efd56e6aca1928879e542eda10901ae94181aa4186c7a50d8453a7de2` |

此检查证明来源对应和源码保护，不能代替微信原生点击、通知 API 行为或全屏像素验收。system sans 只恢复 header／priority 原字体栈；本轮不新增字体文件，也不宣称系统字体跨平台同字形。

## 6. Freeze 与交接

| 文件 | 字节 | SHA-256 |
| --- | ---: | --- |
| `miniprogram/pages/messages/messages.wxml` | 21,339 | `7b8e9bc25ee9175d68210517e9091377d0ca461df0a2e41541729f8aabdb9b9a` |
| `miniprogram/pages/messages/messages.wxss` | 33,781 | `4473440860e25493bd4875a6515dce0b421e5a5a2fa06f36a8d2083e4541ad65` |
| `miniprogram/pages/messages/messages.js`（未改） | 30,759 | `799d2a61281dbb9ffceca63d2fe86a467201ef6de88543c40887ecfd1f2de1e3` |

WXML + WXSS + 两张 SVG 的原文件净新增 **6,378 B**，这是源文件增量；最终微信编译主包大小必须由 root 实际 preview 验证，不能据此推定通过 2 MiB 限制。

本任务 freeze 后的最小剩余工作是：独立 source review；最终同步的 INBOX 原生 header/capsule/sticky、三筛选、搜索开关、CENTER 往返、设置与一条实际授权通知的有限点击；主包真实大小与同 tree GitHub 提交。其他长页模块仍保留原实现，39 屏整体 pixel、正式 AppID/HTTPS/订阅消息/真机及真人运营不属于本次源码 PASS。
