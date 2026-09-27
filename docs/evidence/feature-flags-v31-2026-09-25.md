# T03 功能关闭与环境隔离本机证据（2026-09-25）

复用原有四个原生小程序页面、`src/ai.ts` 的规则提取、服务端默认拒绝未知路由、生产启动检查和 `is_test` 指标过滤。新增 `src/feature-flags.ts` 固定的 R1 能力清单：`ai_draft`、`public_discovery`、`open_matching`、`merchant_payments`、`paid_pro`、`photo_album`、`auto_booking` 均为 `false`。`GET /system/capabilities` 可供客户端读取状态。后续能力保留的 API 命名空间和旧 `/events/drafts:generate` 在身份处理前返回 `403 FEATURE_DISABLED`，不依赖按钮隐藏。已有规则提取移到 `/events/drafts:suggest-local`，返回 `UNAVAILABLE` / `RULE_FALLBACK`，小程序文案继续说明未连接 AI；手动建局照常可用。

先运行新定向测试得到 2 个失败：能力清单 404、小程序仍调用旧路径；修改后 `test/feature-flags.test.ts` 与 `test/api.test.ts` 26/26 通过。全量 `pnpm test` 255/255、`pnpm typecheck`、`git diff --check` 通过。定向测试覆盖七项关闭、构造后续能力请求、旧 AI 请求、基础查询和规则提取；已有 `test/api.test.ts` 覆盖报名和退出主链路。`test/startup.test.ts` 还验证生产拒绝 `DEV_AUTH=1`，报错不回显注入的 AppSecret 哨兵值。服务端现有生产路径只建立真实微信 code 交换适配器，不提供演示适配器配置；试点指标查询排除 `is_test` 和白名单外用户。

微信开发者工具测试号本机模拟器：重新编译打开 `pages/create/create`，填入“六个人打羽毛球，AA大概每人五十”，实际调用页面 `suggest` 后读回类型、6 人、AA 和 50 元规则提取结果，以及未连接 AI 和待确认字段提示；[页面截图](wechat-flags-local-suggestion-2026-09-25.jpg)。尝试 `navigateTo /pages/discovery/discovery` 返回工具运行错误，当前页面仍是 `pages/create/create`；`app.json` 也未声明该深链。此结果只证明本机模拟器入口未开放，不能替代真机或正式版审核。测试后关闭本机 API。

`APP_STAGE` 明确区分 `local`、`test`、`candidate`、`production`；本地与测试的默认 PGlite 路径不同，候选与生产均要求 `NODE_ENV=production` 并走生产登录、运营账号和 PostgreSQL 检查。阶段和 `NODE_ENV` 不匹配时启动失败。`test/runtime-stage.test.ts` 覆盖四类配置与错误组合，`test/startup.test.ts` 验证候选不能开启开发身份、生产不能伪装测试阶段。

AC-ENV 的真正环境隔离仍需候选/生产独立数据库、队列、凭证和日志平台的部署证据；当前没有这些外部资源。真实 AI 接入、正式 AppID、HTTPS 域名、真人试点均未验，不能据此声称完整 R1 通过。
