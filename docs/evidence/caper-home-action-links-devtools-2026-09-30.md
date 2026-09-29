# CAPER 首页灵感与页脚入口（2026-09-30）

使用用户 ZIP 的 `caper_2` 作为视觉与按钮基准，微信开发者工具测试 AppID `wxbbcab69099026d3f`，本地 API 和合成身份；CLI `preview` 编译退出码 0（总包 1,799,818 Byte）。本记录只覆盖本次按钮与布局，不表示 39 屏一比一验收。

1. 首页分类“美食”在自动化页面实点；定向逻辑测试验证先提示“当前只能发起羽毛球活动”，取消后不进入发起页，确认才进入。首页两张非羽毛球灵感卡复用同一能力提示。“运动”进入发起页，“更多”进入发现页的公开找局关闭态。这些图片是设计示意，不是真实公开活动。
2. “候补补位”卡只有在 `/me/events` 返回本人 `OFFERED` 时出现；点击会带一次性 `irlProfileFocusIntent=noticeSection` 进入“我的”，展开本人站内通知区。该深链的合成 `OFFERED` 定向测试通过；本机当前合成账号无有效补位，尚未在模拟器实点非空候补卡。
3. 页脚“关于我们”“隐私政策”“联系我们”三个按钮在开发者工具自动化中依次实点，分别抵达 `pages/about/about`、`subpackages/profile/legal/legal`、`subpackages/profile/support/support`。截图：[完整可见页脚](images/caper-home-footer-actions-2026-09-30.png)、[帮助目的页](images/caper-home-support-route-2026-09-30.png)。首次截图发现底部链接被固定 TabBar 遮挡，已加底部留白后重新截图并复点。
4. 首页“我组织的”卡片补齐真实主办统计：服务端 `/events/:id` 返回裸 `hostId`，客户端开发身份使用带 `dev:` 前缀的缓存键；改为按裸身份比较后，开发者工具实点卡片读到 `detailLoaded=true`、确认 0、预留 0、待审 0、成局缺口 4。截图：[主办统计卡](images/caper-home-host-counts-2026-09-30.png)。该测试活动仍为草稿，数字不是公开招募统计。

定向首页状态测试 10/10、PG10 焦点测试 6/6 和类型检查通过。正式 AppID、HTTPS、真机、真人活动及订阅消息仍按总验收矩阵处理。
