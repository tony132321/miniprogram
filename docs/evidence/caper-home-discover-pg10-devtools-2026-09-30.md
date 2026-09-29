# CAPER 首页状态、发现长页与 PG10 实点（2026-09-30）

## 范围与环境

在现有 R1 工程上对照用户提供的 39 屏 ZIP，接入 `pg02_b/c/d` 首页状态视图、`caper_4` 发现长页中的本人活动区，以及 `pg10_e/f/g` 的协议说明、缓存和帮助页面。微信开发者工具使用测试 AppID `wxbbcab69099026d3f`、本机 API `http://127.0.0.1:3000`、合成主办身份 `host`；本机合成活动 ID 为 `74716b6d-3a87-40b6-91b8-9117fa354bde`。本证据仅代表这些页面与点击路径，不是 39 屏视觉验收。

## 开发者工具点击与回读

1. 首页点击“我组织的”：`activeTab=organized`、`stateView=true`，`visibleItems` 含本机活动 ID；卡片显示服务端活动标题、时间和招募状态，点“主办工作台”进入 `pages/event/event`。图：[首页主办状态](images/caper-home-organized-live-2026-09-30.png)。
2. 首页分别点击“待确认”和“历史”：两者均进入对应状态视图；当前合成身份没有该类活动，所以显示真实空态，而不展示设计图中的人物和活动。图：[待确认空态](images/caper-home-pending-empty-2026-09-30.png)、[历史空态](images/caper-home-history-empty-2026-09-30.png)。
3. 发现页读取当前账号 `GET /me/events`，`personalState=READY`，本人活动列表含上述真实活动 ID；下滑长页可见灵感、照片和城市版块，点本人活动卡进入 `pages/event/event`。灵感素材为示意，不是公开招募列表。图：[发现长页](images/caper-discover-long-live-2026-09-30.png)。
4. 隐私安全页点帮助卡进入 `subpackages/profile/support/support`，展开第一条 FAQ 后点“违规举报”，回到 `pages/me/me` 且 `advancedOpen=true`，展示既有真实举报表单。图：[帮助页](images/caper-support-live-2026-09-30.png)。
5. 协议说明页点击“社区公约”进入 `subpackages/profile/guidelines/guidelines`；正式协议、第三方清单、PDF 和确认动作未开放，不伪造用户同意。图：[协议说明页](images/caper-legal-top-live-2026-09-30.png)。
6. 缓存页由 `wx.getStorageInfoSync` 读取本机数据，本轮 `storageState=READY`、显示 `0.00 MB`；点“重新读取设备存储”再次读取。没有安全分类之前不提供全量清理按钮。图：[缓存页](images/caper-cache-live-2026-09-30.png)。

本轮微信开发者工具 CLI 预览编译成功，总包 1,559,750 Byte；本批完成后核对过 20 条注册页面、332 个模板事件绑定、76 条字面路由。相关定向测试 14/14 与类型检查通过；本地全量和远端 CI 结果以本批提交后的独立记录为准。并行开发中的其他页面变更使后续工作区绑定数继续增长，该数值不是全项目固定总量。

## 仍未验收

- 页面已经向 ZIP 的结构和视觉靠拢，但没有逐像素比对或声称 1:1 完成；原稿中的公开找局、私聊、评价、相册、真正 AI 客服、清理分类和正式协议均缺相应 R1 能力或产品定稿。
- 真实微信 AppID、合法 HTTPS 域名、真机、订阅消息、真人运营和三场受控活动仍无资源，不能用本机合成身份的点击替代。
