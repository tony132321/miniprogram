# 语义 FAQ 候选：本地合成契约

依据 v3.1 `01_PRD_v1.0.md` RQ11、`engineering/tasks/T22.md` 的 AC-RQ11／AC-ANNOUNCEMENT-INJECTION 和 `specs/AI_ACTION_CONTRACT.md` 的最小上下文、保守降级要求，新增独立的 `askSemanticCurrentFact` 合成适配器入口。既有 `/events/:id/facts:ask` 路由仅在显式测试环境中可注入合成提供方；没有真实模型调用。

模型只收到本人有权访问的当前活动上下文和经联系方式裁剪的问题，并只能建议 `sourceContentId`、来源版本和置信度。服务端要求置信度至少 0.9、提问与已审核 FAQ 问句有足够双字片段重合；模型自由文本答案一律不展示。调用后重读本人权限、活动版本、公告审核状态和当前可见版本，最终只返回数据库中已审核 FAQ 的原答案及来源 ID。来源不匹配、改版、低置信度、无模型、异常或超时均调用既有 `askCurrentFact`，由规则回答或产生“尚未确认”主办待办。已有未结案同题待办也交回既有流程，避免自动答案与人工处理状态矛盾。

第 0058 版独立 `ai_semantic_requests` 表在调用适配器前以本人、活动与请求键写入持久 `STARTED`，按原问题哈希拒绝同键不同问题。并发同键只允许首个调用；完成答案存入同一键，重放不再次调用适配器。规则／未知 fallback 使用单独随机内部键，避免与原 `facts:ask` 客户端键串读；重放旧公告答案前重新验证成员权限、当前可见版本和公告审核状态。进程在模型调用中断后遗留的 `STARTED` 拒绝自动重试，超出一分钟进入只含元数据的运营异常列表。第 0060 版增加具名复核历史，同一状态快照只记录一次说明和审计；状态从 STARTED 到 UNKNOWN 或 COMPLETED 后再次进入待复核队列，复核不改变原费用或预算预留。

草稿和语义两条路径都在锁定同一 `events` 行后汇总 `ai_draft_requests` 与 `ai_semantic_requests` 的已知费用及不确定预留。语义调用按该活动剩余预算全额预留，适配器声明的单次费用上界超过余额时不调用。符合契约的回应记录模型版本、prompt hash、输入／输出 token 用量、费用和回执标识哈希；不保留原回执标识或模型自由文本答案。超时、无效费用或无效来源证据保留原预算预留，不自动重试或当作供应商账单结清。返回已受理只表示提供方报告，真实计费仍待核对。

`node --import tsx --test test/ai-semantic-answer.test.ts test/ai-semantic-review.test.ts test/ai-provider-boundary.test.ts test/ai-provider-http.test.ts`：37/37 通过，覆盖未审核公告排除、公告内指令无法进入回答、成员鉴权、无关问题保守待办、模型调用中活动改版、同键重放／不同正文冲突、公告撤审后拒绝旧答案、同键及跨键并发、草稿与语义共享预算、超时费用预留、生产提供方闸门、旧路由键隔离、老化 `STARTED` 异常的元数据列表，以及 STARTED→UNKNOWN→COMPLETED 分状态具名复核。`pnpm typecheck` 通过。该测试只证明服务端边界，不证明模型能正确理解自然语言；双字片段门槛刻意保守，可能漏答同义改写。

`askSemanticCurrentFact` 仅在调用方显式传 `environment: 'test'` 时允许注入提供方；开发与生产环境拒绝。生产继续调用原 `askCurrentFact`。异常列表与具名复核已经接入 `/ops/ai-semantic-alerts` 系列 HTTP 入口，并由入口强制 `JOBS` 权限；定向 HTTP 回归覆盖路由和权限。自由文本公告语义回答、真实模型及价格上界、实际供应商回执／账单核对与真机体验仍未完成。RQ11 仍属部分实现。
