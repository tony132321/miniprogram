# T35 当前候选门禁：代码层补验（2026-09-29）

`pnpm preflight:candidate` 是独立的只读命令，沿用 v3.1 开发包 `governance/STATE_AND_EVIDENCE.md` 与 `scripts/check_gate.py` 的候选、收据、必需 CI、独立评审及设备证据结构。它不进入 GitHub CI 必需任务；缺正式资源时 CI 仍可检查代码，Nick UAT 门禁则保持 `BLOCKED`。

命令默认读取 `docs/evidence/candidate-gate-receipt.json`；也可把收据路径作为第一个参数传入。当前没有该文件，实际运行返回退出码 1、`BLOCKED`、`RECEIPT_MISSING`。没有为了让命令通过而伪造当前 SHA 的真机或运营收据。最终提交冻结后，应由独立工具读取远端 head SHA、完整 required checks/保护规则、同 SHA 的各项 CI job 和原始运行记录，再制作候选收据。无法读取保护规则或任一必需任务状态时填 `UNKNOWN`，门禁拒绝；旧 SHA 的绿灯不能转移。

收据模式 `project-irl/candidate-gate-v1` 至少包含：

- `candidate.gitSha`、`treeSha`、带时区 `frozenAt`、具名 `authorIds` 与 `authorSessionIds`；必须等于本地 Git HEAD/tree，工作区内跟踪文件或未跟踪产品输入有改动时拒绝。
- `requiredCi.sourceStatus=VERIFIED`、`sourceRef`、`sourceObservedAt`、`remoteHeadSha`、`runUrl`、完整 `requiredCheckNames` 与逐项 `jobs{name,candidateSha,status}`。读取当前 `.github/workflows/r1-ci.yml` 的所有 job 作为最低集合，未知、缺少、失败、重复或旧 SHA 拒绝。`sourceRef` 必须指向可独立回读的 GitHub 设置或规则证据；填写 JSON 并不能证明来源真实。
- `independentReview` 的 `reviewerId`、`reviewerSessionId` 必须不同于作者，且 `readOnly`、`candidateUnchanged` 为真。`devtools`、`realDevice`、`webOps`、`authoritativeReadback` 各有当前 SHA、`PASS`、晚于冻结时间的 `observedAt`、`synthetic=false`、位于 `docs/evidence/` 的 `artifactRef` 及文件的 `artifactSha256`。真机另外要有 `device{platform,model,osVersion,appBuild,runId}`。缺项、路径越界或文件内容变更都拒绝。

自动化行为测试 `test/candidate-gate.test.ts` 先复现缺实现，再覆盖未冻结/脏工作区、required CI 来源未知或缺 job、旧 SHA、作者自评或同会话、缺真机身份、Git 实际文件漂移和证据文件篡改；定向 **7/7**，类型检查通过。该脚本只能检查结构和本地字节，**不能认证** GitHub、微信设备、评审者或运营人员；即使输出 `EVIDENCE_CONTRACT_SATISFIED`，也不自动给出 `READY_FOR_NICK_UAT` 或发布授权，仍须原始工具回读与真人批准。
