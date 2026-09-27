# 更新后开发者工具与发布闸门复核（2026-09-27）

在 `a0d54e8` 后的本地工程执行：`pnpm test` 为 418/418 通过，`pnpm typecheck` 退出码 0。`pnpm preflight:release` 退出码 1，明确指出仍使用本机 HTTP API、开发身份、测试 AppID，且项目及本机私有配置关闭合法域名校验。这些是当前本地开发配置；没有将测试环境误标为可发布。

更新后的微信开发者工具 `wechatide` 0.3.11 状态为已登录、CLI 版本匹配。复用现有项目窗口，接入独立合成 PGlite 库 `.data/devtools-regression-20260927` 的本地 API。模拟器编译并打开 `pages/index/index`，页面运行数据为 `loadState=READY`；网络记录显示 `GET /me/events` 返回 200、`items: []`，[截图](wechat-regression-index-2026-09-27.jpg)展示真实空列表。模拟器打开 `pages/create/create`，运行数据为 `editorLoadState=IDLE`、`safetyStatus=OPEN`、`suggestionLoading=false`。两页 JSON 文件在工作区实际存在且页面已运行；console 缓冲区仍有此前“页面 json 文件缺失”文字，故不把 console 记为无错误。

单文件 `compile_wxml` 对首页和“我的”页成功返回 `$gwx`。发起页和活动页的并发请求最初遇到测试 AppID 工具侧 `-80408` 每分钟频率限制；等待窗口恢复后分别串行重试，两页均成功返回 `$gwx`。因此四个现有 WXML 页面各有一次成功的单文件编译结果。此处仅证明本地模拟器与单文件编译，未证明正式 AppID、合法域名网络、真机或真人活动验收。

## 当前候选版本复核

2026-09-27 对 `431c5c8ecccde1c855be6e14a0fec2efa56af864` 重新运行当前工作区的完整检查：`pnpm test` 退出码 0，434/434 通过、0 失败；`pnpm typecheck` 退出码 0。此次测试包含[容量四人、五人报名、候补补位、签到结项与再约的 API 整链路](r1-independent-seats-smoke-2026-09-27.md)。[更新后开发者工具模拟器的独立席位链路](wechat-independent-seats-formation-2026-09-27.jpg)以及[隔离库时间调整后的结项与再约](wechat-independent-seats-completed-2026-09-27.jpg)已另行记录；后者的模拟扫码和时间调整不算真实活动或真机证据。

同一版本的 `pnpm preflight:release` 退出码 1：当前 API 仍指向本机 HTTP；小程序仍启用开发身份和测试 AppID；项目配置的合法域名校验为关闭，本机私有配置也关闭该校验。正式 AppID、已配置的 HTTPS 合法域名、微信登录/订阅消息和真机接入尚无可验证配置，故当前版本只可继续作为本地候选原型。发布前还需独立审核、目标环境 PostgreSQL/备份恢复、真实运营与隐私流程，以及至少三场真实受控活动；434 项本地测试不能代替这些证据。
