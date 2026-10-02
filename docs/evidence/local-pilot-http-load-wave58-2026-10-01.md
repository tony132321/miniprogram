# 本地试点规模 HTTP 负载证据（Wave 58）

日期：2026-10-01。基准提交：`7c6355dc7b3cd5f3f7b99638f293befd41286342`；执行的是下表标识的未提交专项脚本版本。依据 PRD §20.1 的 10,000 注册用户／500 活跃身份／20 RPS 假设，补充本机 PostgreSQL HTTP 证据。

## 执行环境与保护

- Node.js `v24.19.0`、pnpm `11.19.0`、仓库内 PostgreSQL `18.6`；单进程 HTTP 服务、macOS 本机回环地址。
- 复用已停止的 Wave 57 自建隔离 cluster，仅创建本轮新的数据库 `irl_r1_test_pilot_wave58_20261001_a2`，没有复用任何已有业务库或首轮测试库。
- 写入前独立查询确认 `current_database=irl_r1_test_pilot_wave58_20261001_a2`、`inet_server_addr=127.0.0.1`、`current_schema=public`、用户关系对象数 `0`。
- 脚本仍在迁移及任何写入前执行 URL 和空库保护。500 个会话经现有 `loginWithWechat` 流程签发；微信交换回调使用合成 openid，不涉及真实微信服务。
- 10,000 个合成用户中，500 个用户各有一条通过现有 `createDraft` 创建的本人种子草稿。合成公开值守、独立复核和活动审核准备沿用既有脚本；HTTP 服务使用 Bearer 校验且 `devAuth=false`。

执行命令：

```sh
PATH=/Users/tsb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH IRL_BENCHMARK_PROFILE=pilot IRL_PG_TEST_URL=postgresql://irl_wave57@127.0.0.1:55457/irl_r1_test_pilot_wave58_20261001_a2 pnpm exec tsx scripts/benchmark-http.ts
```

专项退出码 `0`。目标派发窗口 30 秒，实际测量窗口包含所有响应读取并保持至少 30 秒；种子准备时间和测量时间分别输出，30 秒不表示命令总耗时。每个请求及响应体读取有 `AbortSignal.timeout(5000)` 截止时间；网络或超时记为 status `0` 的失败并使门禁失败。

## 被测文件绑定

最终专项执行前、执行后对以下文件取 SHA-256，结果一致。验证过程中未改业务代码。

| 文件 | 执行前后一致的 SHA-256 |
| --- | --- |
| `scripts/benchmark-http.ts` | `cc6f246363ba1e481645c5dd0e6fe422fe2dd6db650036067ae7bb601f529422` |
| `src/server.ts` | `c2812856dfc89cb64cc275ba1a089903bdcd99b797cb5bff56e7356d308aa8b7` |
| `src/db.ts` | `cf9ecac7cd618f074202f74591c08ae82e77733d21e29d7de8e32433fde9373d` |
| `src/public-gate.ts` | `2140a0a96c1abfad10e19a96c38829d056fadf273e26476eda892a914e9e1520` |

## 最终专项结果

实际测量 `30.001877333` 秒，600 次请求及完整响应，实测 `19.998748522981305` RPS。500 个不同身份均获得成功响应；120 次本人活动列表均回读到该身份自己的种子草稿。注册用户 10,000、会话 500、种子草稿 500；准备完成活动 501／草稿 500／报名 1，结束活动 561／草稿 560／报名 1。

| 路径 | 请求／成功 | 错误 | 原始 p95 (ms) | ≤800ms |
| --- | --- | --- | --- | --- |
| `GET /events/:id`，单场活动详情 | 420／420 | 0 | 8.758166999999958 | true |
| `GET /me/events`，浅本人列表 | 120／120 | 0 | 6.247915999999805 | true |
| `POST /events`，草稿写入 | 60／60 | 0 | 9.577125000000024 | true |
| 混合 | 600／600 | 0 | 8.71387500000128 | true |

百分位使用最近秩（`ceil(n×fraction)-1`），门禁使用未舍入数值。混合及每类接口均要求 p95≤800ms；HTTP／网络失败和内容核验失败为零。排程迟到原始 p95 `2.265917000000627`ms，最大 `29.283583000000363`ms；`scheduleToleranceMs=50`，`gates.offeredLoad=true`。50ms 为一个请求间隔的本脚本负载生成器容差，检查派发是否按目标排程执行，并非新增 PRD 指标或长期可用率阈值。全部门禁为 `true`。

完整原始输出：

```json
{
  "database": "irl_r1_test_pilot_wave58_20261001_a2",
  "profile": "pilot",
  "registeredUsers": 10000,
  "sessions": 500,
  "activeIdentities": 500,
  "uniqueActors": 500,
  "seedDrafts": 500,
  "seedCounts": {
    "registeredUsers": 10000,
    "sessions": 500,
    "events": 501,
    "drafts": 500,
    "registrations": 1
  },
  "finalCounts": {
    "registeredUsers": 10000,
    "sessions": 500,
    "events": 561,
    "drafts": 560,
    "registrations": 1
  },
  "rateTargetRps": 20,
  "durationSeconds": 30,
  "elapsedSeconds": 30.001877333,
  "preparationSeconds": 0.530398375,
  "requests": 600,
  "responses": 600,
  "achievedRps": 19.998748522981305,
  "requestCounts": {
    "eventReads": 420,
    "myEventsReads": 120,
    "draftWrites": 60
  },
  "successfulRequestCounts": {
    "eventReads": 420,
    "myEventsReads": 120,
    "draftWrites": 60
  },
  "endpoints": {
    "eventReads": {
      "requests": 420,
      "responses": 420,
      "successes": 420,
      "errors": 0,
      "p95Ms": 8.758166999999958,
      "p95WithinTarget": true
    },
    "myEventsReads": {
      "requests": 120,
      "responses": 120,
      "successes": 120,
      "errors": 0,
      "p95Ms": 6.247915999999805,
      "p95WithinTarget": true
    },
    "draftWrites": {
      "requests": 60,
      "responses": 60,
      "successes": 60,
      "errors": 0,
      "p95Ms": 9.577125000000024,
      "p95WithinTarget": true
    }
  },
  "seededMyEventsReads": 120,
  "dispatchLatenessMs": {
    "max": 29.283583000000363,
    "p95": 2.265917000000627
  },
  "errors": 0,
  "httpFailures": 0,
  "contentFailures": 0,
  "failureExamples": [],
  "p50Ms": 6.741749999999229,
  "p95Ms": 8.71387500000128,
  "p99Ms": 10.095625000001746,
  "mix": {
    "eventReads": 0.7,
    "myEventsReads": 0.2,
    "draftWrites": 0.1
  },
  "p95LimitMs": 800,
  "requestTimeoutMs": 5000,
  "scheduleToleranceMs": 50,
  "gates": {
    "registeredUsers": true,
    "sessions": true,
    "seedData": true,
    "requestMix": true,
    "completeResponses": true,
    "successfulActors": true,
    "seededMyEventsReads": true,
    "noUnexpectedFailures": true,
    "persistedWrites": true,
    "measurementWindow": true,
    "offeredLoad": true,
    "p95": true
  },
  "localGatePassed": true,
  "localOnly": true
}
```

HTTP 结束后另用 `psql` 独立回读确认：注册用户 `10000`、会话 `500`、不同会话用户 `500`、活动 `561`、草稿 `560`、报名 `1`、`is_test=true` 活动 `561`、本人种子草稿不同主办方 `500`。独立回读与脚本输出一致。

## 独立复核发现与定向修复

首轮新空库 `irl_r1_test_pilot_wave58_20261001_a1` 使用脚本 SHA-256 `424f01bee1d3003a636480ab78291985071b692c844286995ba29c34e3560026`，600 次成功、500 成功身份、零错误；实际 `30.002668209` 秒、`19.998221352193468` RPS，最大派发迟到 `2.0163749999992433`ms、混合 p95 `9.01745800000026`ms。此轮只保留为修复前参考，最终验收使用 a2 和上表最终脚本哈希。

独立 review 发现旧门禁仅要求测量窗口≥30秒，排程严重迟到仍可通过。定向探针直接从实际脚本提取 `gates` 源码，设置 600 完整成功请求、500 成功身份、正确数据计数、低 p95、`elapsedSeconds=60`（10 RPS）和最大派发迟到 `30000`ms：

- 修复前：所有旧门禁 `true`，`localGatePassed=true`。
- 修复后：新增 `gates.offeredLoad=false`，`localGatePassed=false`；原 p95 门禁仍 `true`。

随后创建另一新空库 a2 执行最终版本专项，未重用首轮库、未放宽 50ms 容差。

## 其他定向校验与结束状态

- `pnpm typecheck`：最终脚本通过，退出 `0`。
- `node --import tsx --test test/postgres-verification-guard.test.ts`：既有保护测试 `3/3` 通过，覆盖 URL 查询覆盖参数、非 public 对象／search_path、CI 容器地址显式授权和空库要求。
- `git diff --check`：专项文件通过。
- HTTP 应用及连接池在脚本 `finally` 关闭。独立 SQL 回读后，自建 PostgreSQL 执行 `pg_ctl -m fast -w stop`，输出 `server stopped`；确认 `postmaster.pid` 不存在。
- 本批没有运行全量测试、模拟器、GitHub workflow 或提交／推送。默认 `sample` 保留 20 用户／20 会话的旧规模；本批实际执行 `pilot`。

## 证据范围

这是本机短时合成负载：10,000 条用户记录、500 个实际成功使用的身份、单场热点活动详情和浅本人列表。500 与 10 的取模周期一致，同一身份固定参与一类接口；对应 350 个详情身份、100 个本人列表身份和 50 个草稿写身份，前 100 个身份在 600 次请求中被再次触及。因此不能推称每个身份遍历三类接口、复杂分页或多活动分布。

零非预期 HTTP／网络失败是本机专项门禁，不能等同 99.5% 月可用性。500 个短时合成活跃身份不能证明真实 DAU；此结果也不覆盖真实微信交换、TLS／反向代理、外部通知／AI、目标部署硬件或长时负载。100 个并发争抢最后席位沿用独立 PostgreSQL 证据，本批未重复执行。
