# AC-API-PERF：当前候选本机 HTTP 混合负载

## 范围和前置条件

2026-09-29 在 macOS 27.0、Apple Silicon arm64（10 核、16 GiB）上，使用 Node.js 24.19.0、pnpm 11.19.0 和本机 PostgreSQL 18.6。脚本只接受 `127.0.0.1` 上、名称以 `irl_r1_test_` 开头的空白数据库；本次使用独立库 `irl_r1_test_http_load_20260929`。HTTP 服务只监听 `127.0.0.1` 的随机端口，没有调用正式微信、通知或外部 AI 服务。

本次起点为远端候选 `44d9725ce8251758a52f32cf4d0ffe789a51717f`，运行时工作区有尚未提交的修复。为精确标识被测代码，运行前后以下文件的 SHA-256 相同：`scripts/benchmark-http.ts` 为 `12e1ba96daa672bcfdf12a721737ff29e0d7facf689de4de2b0260cfbf8a5e3d`，`src/server.ts` 为 `43eb01cd4718597bc8ac0e3fe1d92b0d9a29f949f1bf957751354240cd1bce7f`，`src/db.ts` 为 `c01fc99e822301b46da68bdc9524b44c4c0c603abed427c86d7f342a96a641df`，`src/public-gate.ts` 为 `2140a0a96c1abfad10e19a96c38829d056fadf273e26476eda892a914e9e1520`。

首次运行沿用旧脚本，在发布合成公开活动时收到 `PUBLIC_RECRUITMENT_PAUSED`，未进入压测阶段。原因是当前安全策略默认关闭公开招募，旧夹具没有设置具名值守。修复仅限 `scripts/benchmark-http.ts`：在隔离库内创建当前至活动结束均有效的合成值守，使用不同运营身份复核后打开合成公开招募；随后仍由人工审核函数批准测试活动。真实业务默认关闭策略未修改。该失败不能算作 HTTP 性能失败。清空失败运行产生的测试库后重新创建空库，再运行下面的命令。

```sh
.data/tools/pgsql-18.6/bin/createdb -h 127.0.0.1 -p 55432 irl_r1_test_http_load_20260929
PATH=/Users/tsb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH \
IRL_PG_TEST_URL=postgres://tsb@127.0.0.1:55432/irl_r1_test_http_load_20260929 \
pnpm exec tsx scripts/benchmark-http.ts
```

`createdb` 仅在目标库尚不存在时执行；每次重跑需使用新的空白测试库。

## 结果

脚本建立 20 个合成身份、一场已审核的公开活动，启动真实 HTTP 服务后，按 20 RPS 持续 30 秒发送 600 个请求：70% 活动详情读、20% 本人活动列表读、10% 创建草稿。全部请求经过 Bearer 会话校验，写入有独立幂等键。脚本读取完整响应并对预期 HTTP 状态进行检查。

| 指标 | 本机实测 |
| --- | ---: |
| 目标 / 实际吞吐 | 20 / 20.0 RPS |
| 请求 / HTTP 失败 | 600 / 0 |
| p50 / p95 / p99 | 4 / 7 / 8 ms |

脚本退出码为 0；`pnpm typecheck` 与 `git diff --check` 通过。直接从测试 PostgreSQL 回读的 `users / events / public_recruitment_coverage / gate.status / approved events` 为 `20 / 61 / 1 / OPEN / 1`，即 1 场经审核公开活动和 60 个草稿。测试 HTTP 实例在脚本结束时关闭；独立测试库保留供本机复查。

本机 p95 7 ms 低于开发包 `AC-API-PERF` 的待验证目标 p95 ≤ 800 ms，但这只构成**本机合成基线通过**。尚未约定并装载试点数据量，也未包含 TLS/反向代理、目标服务器规格、真实微信登录、运营并行流量或长时间可用性；目标部署环境的正式试点负载与错误率仍为 `NOT_RUN`，不能据此宣称整项验收通过。
