# GitHub CI PGlite / Node Wasm 崩溃缓解（2026-09-28）

## 现象与定位

[R1 CI run 36344542138](https://github.com/tony132321/miniprogram/actions/runs/36344542138) 的第 1 次尝试在 `Test` 步骤失败；第 2 次尝试在同一提交上通过 `Typecheck`、`Test` 和 `Dependency audit`。失败输出含 Node 24.19.0 / V8 的 `ThreadIsolation::UnregisterWasmAllocation`、`jit_page_->allocations_.erase(addr) == 1` 原生断言，测试文件显示为 `privacy-export.test.ts`。这是进程级错误；重跑通过说明它不对应稳定可复现的业务断言失败。

项目的 `@electric-sql/pglite` 0.5.8 在多数测试文件中创建内存 PostgreSQL。原 `pnpm test` 允许 4 个文件并行。[Node 测试运行器文档](https://nodejs.org/download/release/v24.15.0/docs/api/test.html) 说明每个测试文件运行在独立子进程中，`--test-concurrency` 控制同时运行的文件数。[Node issue #64500](https://github.com/nodejs/node/issues/64500) 与 [PGlite issue #1053](https://github.com/electric-sql/pglite/issues/1053) 已记录并发 PGlite 子进程触发的间歇性 Node / Wasm 原生崩溃，顺序对照未复现；报道覆盖 Node 22、24、25、26。上游的症状与本次 CI 同属原生 Wasm 失效，但没有证据证明 V8 的确切断言属于同一根因。

## 缓解与验证

`package.json` 将 `pnpm test` 的文件并发从 4 降为 1。全部测试文件仍在独立子进程中执行，未过滤测试；这避免了**本套测试**同时初始化多个 PGlite 进程。没有改动业务代码、Node 版本或 PGlite 版本。

在本地 Node 24.19.0、pnpm 11.19.0 下，原 4 文件并发完整测试为 515/515 通过、96.40 秒；执行新脚本对应命令 `pnpm exec tsx --test --test-concurrency=1 test/*.test.ts` 为 515/515 通过、232.51 秒；`pnpm typecheck` 与 `git diff --check` 通过。串行耗时约为原来的 2.4 倍，仍低于 CI 的 15 分钟任务上限。上述是 macOS 本地结果；此变更进入 PR 后还需观察 Linux GitHub CI。

这是一项降低已知并发触发条件的缓解，不能宣称修复 Node / V8 的原生缺陷。若后续串行 CI 仍出现同类崩溃，应保留原生日志并重新定位；不应把原生崩溃当成应用断言或靠盲目重跑掩盖。

## 后续观察

[R1 CI run 36356118282](https://github.com/tony132321/miniprogram/actions/runs/36356118282) 在串行 536 项测试运行中，已通过前一项个人导出断言，随后 `privacy-export.test.ts` 子进程发生 Node 24.19.0 原生 `jit_page_->allocations_.erase(addr) == 1` 断言，堆栈进入 `ThreadIsolation::UnregisterWasmAllocation`。该文件没有报告 JavaScript 断言失败；最终记录 535 通过、1 个测试文件进程失败。说明串行文件执行并未消除此类运行时故障。随后对**同一提交**发起一次失败任务重跑；不能以先前通过的功能提交 CI 替代该次结果。

该运行的第二次尝试在相同提交、未改代码的情况下通过类型检查、测试及依赖审计。这支持“间歇性原生故障”的判断，但并未证明当前串行命令稳定。

下一候选将测试命令改为 `node --no-wasm-tier-up --import tsx --test --test-concurrency=1 test/*.test.ts`。该 V8 参数由测试运行器传给文件子进程，已用独立临时测试读取 `process.execArgv` 核对。Node 上游问题报告记录 Node 25 在此参数下的受控对照，但也说明 Node 27 仍曾复现，故这里只把它作为试验性缓解。macOS Node 24.19.0 本地 `pnpm test` **537/537** 通过，耗时约 218 秒；`pnpm typecheck` 与 `git diff --check` 通过。必须看新候选的 Linux CI 结果，单次通过亦不能证明原生问题已根治。

[R1 CI run 36356948118](https://github.com/tony132321/miniprogram/actions/runs/36356948118) 已证明此试验**无效**：同样的 `jit_page_->allocations_.erase(addr) == 1` 与 `ThreadIsolation::UnregisterWasmAllocation` 原生崩溃改在 `ai-provider-http.test.ts` 出现。该运行 534 项通过、1 个测试文件进程失败，约 633 秒，依赖审计被跳过。参数未能消除故障且明显增加 Linux 测试耗时，后续候选应撤回。前述本地通过只说明功能断言在那次 macOS 运行中通过。

紧接的[带相同参数的 CI run 36357323180](https://github.com/tony132321/miniprogram/actions/runs/36357323180) 也在 `report-scope.test.ts` 子进程出现同一原生断言，534 项通过、1 个测试文件进程失败，约 611 秒。两次故障出现在不同测试文件，不能把它们归因于某条稳定失败的业务断言。

第二种候选改用 Node 24 测试运行器的 `--test-isolation=none`，仍保留全部 `test/*.test.ts` 文件和串行执行，让测试不再为每个文件创建新的 Node/V8 子进程。先对触发过原生崩溃的 AI 草稿 HTTP 与个人导出文件联合运行 13/13，再在 macOS Node 24.19.0 完整运行 **537/537**，耗时约 194 秒；这些结果还不能证明 Linux CI 稳定。该模式允许测试文件共享一个进程，若后续出现跨文件状态串扰，应修复隔离而非隐藏失败。生产代码不依赖此测试运行器参数。

[单进程候选 CI run 36357944846](https://github.com/tony132321/miniprogram/actions/runs/36357944846) 在 Linux Node 24.19.0 首次运行通过：类型检查成功、测试 **537/537**，测试耗时约 537 秒、依赖审计成功。与先前两次带 `--no-wasm-tier-up` 的失败相比，这是实际远端改进；但原生崩溃有间歇性，单次绿色结果不证明根治。后续对同一代码的独立 CI 仍需观察。

后续两个仅修改验收文档和模拟器证据、未改测试脚本或产品代码的候选也各自完成 Linux CI：[run 36358585487](https://github.com/tony132321/miniprogram/actions/runs/36358585487) 与 [run 36358968024](https://github.com/tony132321/miniprogram/actions/runs/36358968024) 的类型检查、**537/537** 测试及依赖审计均通过。第三轮测试耗时约 467 秒。三次独立绿色运行增加了单进程测试命令在当前 CI 环境下可用的证据；原生崩溃的上游根因仍未被证明已修复。
