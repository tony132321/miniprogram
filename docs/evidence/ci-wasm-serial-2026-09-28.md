# GitHub CI PGlite / Node Wasm 崩溃缓解（2026-09-28）

## 现象与定位

[R1 CI run 36344542138](https://github.com/tony132321/miniprogram/actions/runs/36344542138) 的第 1 次尝试在 `Test` 步骤失败；第 2 次尝试在同一提交上通过 `Typecheck`、`Test` 和 `Dependency audit`。失败输出含 Node 24.19.0 / V8 的 `ThreadIsolation::UnregisterWasmAllocation`、`jit_page_->allocations_.erase(addr) == 1` 原生断言，测试文件显示为 `privacy-export.test.ts`。这是进程级错误；重跑通过说明它不对应稳定可复现的业务断言失败。

项目的 `@electric-sql/pglite` 0.5.8 在多数测试文件中创建内存 PostgreSQL。原 `pnpm test` 允许 4 个文件并行。[Node 测试运行器文档](https://nodejs.org/download/release/v24.15.0/docs/api/test.html) 说明每个测试文件运行在独立子进程中，`--test-concurrency` 控制同时运行的文件数。[Node issue #64500](https://github.com/nodejs/node/issues/64500) 与 [PGlite issue #1053](https://github.com/electric-sql/pglite/issues/1053) 已记录并发 PGlite 子进程触发的间歇性 Node / Wasm 原生崩溃，顺序对照未复现；报道覆盖 Node 22、24、25、26。上游的症状与本次 CI 同属原生 Wasm 失效，但没有证据证明 V8 的确切断言属于同一根因。

## 缓解与验证

`package.json` 将 `pnpm test` 的文件并发从 4 降为 1。全部测试文件仍在独立子进程中执行，未过滤测试；这避免了**本套测试**同时初始化多个 PGlite 进程。没有改动业务代码、Node 版本或 PGlite 版本。

在本地 Node 24.19.0、pnpm 11.19.0 下，原 4 文件并发完整测试为 515/515 通过、96.40 秒；执行新脚本对应命令 `pnpm exec tsx --test --test-concurrency=1 test/*.test.ts` 为 515/515 通过、232.51 秒；`pnpm typecheck` 与 `git diff --check` 通过。串行耗时约为原来的 2.4 倍，仍低于 CI 的 15 分钟任务上限。上述是 macOS 本地结果；此变更进入 PR 后还需观察 Linux GitHub CI。

这是一项降低已知并发触发条件的缓解，不能宣称修复 Node / V8 的原生缺陷。若后续串行 CI 仍出现同类崩溃，应保留原生日志并重新定位；不应把原生崩溃当成应用断言或靠盲目重跑掩盖。
