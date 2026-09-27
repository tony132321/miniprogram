# v3.1 本人数据短时导出验收（2026-09-25）

来源：开发包 `AC-EXPORT-ISOLATION`，复用现有 `exportPersonalData` 与个人页“复制本人数据 JSON”功能。第 22 版迁移新增服务端导出凭据表。本人使用幂等 `POST /privacy/exports` 获得有效期 10 分钟的路径，再携当前身份 `GET` 该路径获取动态生成的 JSON；不生成公开对象存储文件。其他身份使用同一路径返回 404，本人过期后返回 410 `EXPORT_EXPIRED`。旧的直接认证读取接口保留供兼容，个人页改走短时路径。人工签到导出中的 `requested_by` 第三方账号 ID 改为 `requested_by_me` 布尔值；屏蔽导出也不包含目标账号 ID。

先加入失败用例：新路径原返回 404；旧导出包含主办方原始 ID。实施后 `test/api.test.ts` 用测试时钟验证本人领取、跨身份拒绝与过期拒绝；`test/privacy-export.test.ts` 验证第三方 ID 不出现在该字段；`test/miniprogram.test.ts` 验证个人页先领凭据再读取 JSON。全量 `pnpm test` 235/235、`pnpm typecheck` 与 `git diff --check` 通过。

微信开发者工具测试 AppID、本机 API 与 `.data/wechat-block-20260925` 合成库：以 `p2` 身份实际点击“复制本人数据 JSON”，页面显示[复制成功提示](wechat-export-ticket-2026-09-25.jpg)。停止 API 后回读持久库，新增一条 `p2` 的凭据，`created_at=2026-09-25T13:08:54.304Z`、`expires_at=2026-09-25T13:18:54.303Z`。这证明模拟器按钮走通服务端路径；跨身份和过期拒绝由独立 HTTP 测试证明。未证明真机保存文件或正式微信身份。
