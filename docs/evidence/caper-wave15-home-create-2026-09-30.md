# CAPER 首页与发起页对照及定向修复（Wave 15）

检查时间：2026-10-01（Asia/Shanghai）。本轮先对照 ZIP 原稿、当前源码和既有截图，再用独立小程序副本补充两条当前身份防护的开发者工具点击。该局部实点不等于逐像素或真机验收。

## 对照来源与结论

读取用户提供的 `stitch_design_system_generator (2).zip` 中 `caper_2`、`pg03_ai`、`caper_ai`、`pg04` 四组 `screen.png` 与 `code.html`，并对照 `miniprogram/pages/index/index.*`、`miniprogram/pages/create/create.*` 和既有 `docs/evidence/images/caper-home-longfeed-top-2026-09-30.png`、`caper-create-idea-live-2026-09-30.png`、`caper-create-form-live-2026-09-30.png`、`caper-create-review-live-2026-09-30.png`。

| 参考稿 | 当前可核对的页面结构和点击 | 保留的 R1 真实边界 |
| --- | --- | --- |
| `caper_2` | 品牌／城市／消息／个人、渐变想法输入、六类灵感、羽球主卡、长页主题和页脚已落在首页；本人活动卡读取 `/me/events` 并进入相同活动 ID。 | 原稿公开热门、附近、推荐与人物评价不作为真实活动展示；静态照片标示为示意。Hero 一句话只传入发起页，不自动发布。 |
| `pg03_ai` | 活动构思页保留大输入、字数、三条灵感、换一批、草稿箱、手填与底部主操作。 | 当前调用 `/events/drafts:suggest-local`；咖啡和小酒局点击反馈“暂未开放”，不把它们写成羽球草稿。 |
| `caper_ai` | 完整表单保留类别网格、时间地点、人数、费用、可见性、协办、预览与底部草稿／确认操作。 | R1 只可创建羽球；语音、其他类别、海报、真实模型生成和自动订场仍无服务端能力。 |
| `pg04` | 确认页逐项列当前草稿信息，每行回到对应表单区；保存与确认发布调用既有 API。 | 原稿“AI 已完善”“已预订”“需要付款”不能无条件照搬，实际展示规则建议、主办方核实状态和 AA 上限。 |

参考图尺寸并不统一：`caper_2` 为 177×1600，`pg03_ai` 为 718×1600，`caper_ai` 为 238×1600，`pg04` 为 780×1704；既有微信模拟器截图还包含原生状态栏／胶囊。当前不能据这些不同画布声称四页已一比一逐像素验收。原稿中的 AI、公开匹配、非羽球类别也需要对应后端能力才能完整接通。

## 本轮可复现的功能缺口与修复

1. 首页曾在身份切换后保留旧 `tokenInput`，旧账号的邀请口令仍可从当前页导航。现于身份变化时清空口令与能力提示，并在点击“打开邀请”时阻止跨账号旧口令。
2. 发起页的本地规则建议、保存草稿、已发布活动变更预览、发布响应曾可能在异步等待期间跨账号回填编辑器或打开旧活动。现用发起身份与当前页面载入代数核对响应；旧响应不能覆盖新编辑状态或触发导航。未重新进入页面时，旧账号表单会清空并提示重新输入。
3. 发起页参考稿把“草稿箱→头像”排在标题右侧。当前模拟器原先把头像放在返回键旁；现按原稿顺序移到微信原生胶囊左侧，读取胶囊边界计算两个按钮内边距；确认页只显示“更多”，标题居中。头像改为白色人物轮廓，不再用棋子字符。

四条异步路径均先由新定向测试复现失败，再修复。未新增设计稿虚构的业务按钮或服务端端点。

## 定向验证

- `node --import tsx --test test/miniprogram-caper-home-states.test.ts test/miniprogram-caper-home-state-views.test.ts test/miniprogram-caper-home-hero-unread.test.ts`：30/30 通过。
- `node --import tsx --test test/miniprogram-caper-create.test.ts test/miniprogram-caper-create-tabbar.test.ts test/miniprogram-caper-create-reference-gaps.test.ts test/miniprogram-profile-create-gates.test.ts`：20/20 通过。
- `pnpm typecheck`（使用工作区绑定的 Node 路径）：退出码 0。
- `git diff --check`：退出码 0。

### 隔离微信开发者工具聚焦实点

副本 `/private/tmp/project-irl-wave15-profile-app` 与仓库 `miniprogram/` 比较时仅 `config.js` 不同（`diff -qr --exclude=config.js` 退出码 0）；副本 API 指向独立本机合成服务 `127.0.0.1:3037`，测试 AppID 为 `wxbbcab69099026d3f`。微信开发者工具 CLI `auto --auto-port 9494 --port 21467` 启动成功，`miniprogram-automator` 连接 `ws://127.0.0.1:9494`。

- 首页在旧身份输入口令后切换合成开发身份，**实际点击**“打开邀请”，仍停留 `pages/index/index`，口令长度归零，显示“账号已切换，请重新输入邀请口令”；小程序异常 0。[页面截图](images/caper-wave15-home-invite-identity-2026-10-01.png)。
- 发起页在旧身份输入羽球想法后切换合成开发身份，**实际点击**输入卡发送按钮，仍停留 IDEA，`aiText` 清空、`draft` 为空，显示重新输入提示；小程序异常 0。[页面截图](images/caper-wave15-create-identity-2026-10-01.png)。
- 聚焦脚本退出码 0，并恢复首页及原合成开发身份。延迟异步响应分支由前述红灯／绿灯定向测试覆盖，未人为拖慢或篡改本机 API 来制造模拟器响应。
- 发起页顶部复验：按胶囊坐标算出的头像／草稿箱右侧内边距为 `102px`／`136px`；**实际点击**头像进入 `pages/me/me`，再次从发起页点击草稿箱进入首页仅本人草稿视图，再从手填入口进入 FORM。IDEA、FORM [截图](images/caper-wave15-create-header-idea-2026-10-01.png)、[截图](images/caper-wave15-create-header-form-2026-10-01.png) 均为更新后的控件顺序；异常 0，脚本退出码 0，最终恢复首页。

按用户要求，本轮未运行全量测试。`caper_2`、`pg03_ai`、`caper_ai`、`pg04` 的同尺寸视觉对比及每个设计按钮的最新逐点穿行仍待单独采集；既有截图和这两张新截图只证明对应采集状态。
