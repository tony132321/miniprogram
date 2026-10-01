# 本地试点规模 HTTP 验证执行计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. 用户已授权并行自主推进；不再请求重复批准，不运行全量测试。

**Goal:** 补齐既有 HTTP 基线在 10,000 个合成注册用户、500 个活跃身份、20 RPS 下的本地验证，并保留真实环境边界。

**Architecture:** 扩展现有脚本为 `sample` 和 `pilot` 两档，默认保留旧样本档；数据库仍必须通过空库和回环保护。试点档通过合成用户种子、真实登录函数和现有草稿领域函数准备数据，不修改产品接口或业务默认开关。

**Tech Stack:** Node.js、TypeScript、现有 PostgreSQL 18.6、Bearer HTTP API。

**Spec:** `Project_IRL_Autonomous_Engineering_Package_v3.1/01_PRD_v1.0.md` §20.1；`docs/acceptance-matrix.md` AC-API-PERF 当前缺口。

## Global Constraints

- 试点假设 1 万注册用户、500 日活、20 RPS 稳态；普通业务 API p95≤800ms，不含外部 AI。
- 本批 30 秒只触及 500 个合成身份，不证明真实 DAU、月可用性或目标部署性能。
- 100 个并发抢最后席位沿用独立 PostgreSQL 证据，本批不重复执行。
- 用户要求不跑全量测试，每批 GitHub 上传；提交带 `[skip ci]`。

## Review Focus

- 既有数据库或非回环地址必须在任何写入前被拒绝。
- 500 个身份必须真正发起成功 HTTP 请求，不能只扩大身份数组。
- p95 阈值采用未四舍五入数值；等于 800ms 通过，大于 800ms 失败。
- 非预期 HTTP／网络错误必须报告并使脚本退出非零；不是月可用性推算。
- 种子与压测请求的数据量分别记录，所有记录保持合成标记。

### Task 1: 扩展既有专项脚本并执行

**Files:** Modify `scripts/benchmark-http.ts`; Modify `README.md` 的现有压测段；Create `docs/evidence/local-pilot-http-load-wave58-2026-10-01.md`。

**Interfaces:** 消费现有 `createProductionDatabase`、`loginWithWechat`、`createDraft`、公开值守和审核函数；新增环境选项 `IRL_BENCHMARK_PROFILE=pilot`，默认 `sample`。输出注册人数、会话数、种子／结束数据量、成功身份数、混合与各端点延迟、调度偏差、错误及明确门禁结论。

- [x] 保留空库保护；试点档种下 10,000 用户，500 用户使用真实登录取得 token，每人建立一条本人草稿。
- [x] 保留原合成公开活动及 70/20/10 请求组合；逐请求轮转身份，记录成功 actor 数。
- [x] 以实际数据计数和混合／三类端点未舍入 p95 作门禁；请求截止 5 秒，超时记失败。输出后设置非零退出码，避免错误被摘要掩盖；调度偏差与实际吞吐单独报告。
- [x] 运行类型、差异检查；只执行新建空库的 pilot 专项及必要保护检查，不跑全量。
- [ ] 独立代理复核代码和输出后，更新验收证据并提交上传。

## 执行结果

最终 a2 专项及独立复核见 `docs/evidence/local-pilot-http-load-wave58-2026-10-01.md`。额外发现生成器低负载假通过，新增最大派发迟到≤一个请求间隔（50ms）的本脚本容差门禁；负例已拒绝，最终负载通过。用户已经授权执行，所有检查仅限本批专项。提交／上传由根代理统一完成。
