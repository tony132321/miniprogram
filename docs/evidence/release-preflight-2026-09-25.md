# 小程序发布静态配置检查（2026-09-25）

新增 `pnpm preflight:release`，检查小程序 API 是否为公开 HTTPS 域名、开发身份是否清空、项目 AppID 是否替换本地测试号，以及公开和本机私有的开发者工具配置是否都开启合法域名校验。命令仅输出固定问题描述，不打印配置里的身份、域名或密钥。

当前仓库仍为本地开发配置，命令预期以退出码 1 失败，列出五项：本机 HTTP API、开发身份、测试 AppID、`project.config.json` 的域名校验关闭、`project.private.config.json` 的本机覆盖也关闭。`test/release-preflight.test.ts` 验证这些条件及一个静态上可通过的样例；全量 `pnpm test` **176/176**、`pnpm typecheck` 与 `git diff --check` 通过。静态检查通过仍不能替代微信后台真实 AppID 与域名白名单、HTTPS 实际连通性、开发者工具和真机验收。
