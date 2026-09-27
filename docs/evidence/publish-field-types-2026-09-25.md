# 发布字段类型校验

运行时 JSON 可绕过 TypeScript 类型声明。`test/events.test.ts` 将数字标题、数组城市、对象场馆、非字符串日期及取消规则保存为草稿，再逐项尝试发布。修复前数字标题在 `.trim()` 处抛出 `TypeError`；修复后所有这些错误类型均返回 `INVALID_EVENT`。`test/api.test.ts` 进一步验证服务端 HTTP 响应为 400 且包含机器可读错误码，不返回内部错误。

本地全量 `pnpm test` **221/221**、`pnpm typecheck` 与 `git diff --check` 通过。草稿可以保存不完整字段；本验证针对发布闸门的错误类型处理，不表示所有草稿输入都经过完整业务校验。
