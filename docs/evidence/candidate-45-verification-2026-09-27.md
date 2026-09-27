# 第 45 版代码候选本地与 PostgreSQL 验证（2026-09-27）

在现有 R1 工程上追加 T30 合成 AI 动作审批协议、停用账号通知与昵称边界、微信开发者工具候选版回归，以及 GitHub CI 触发去重。AI 动作接口仅在隔离 `test` 环境开放；真实模型和用户审批界面仍关闭，不能据此宣称 AI 已上线。

## 当前工作树验证

- `pnpm test`：**473/473 通过，0 失败**；`pnpm typecheck`、`pnpm audit --audit-level high`、`git diff --check`：退出码 0。
- `scripts/verify-postgres.ts` 在本机 PostgreSQL 18.6 全新隔离库 `irl_r1_test_final45b_20260927`：退出码 0，`migrations:45`、`pools:2`、`contenders:100`、`confirmed:4`，包含公开值守撤销及原有容量、权限和任务跨池检查。
- `scripts/verify-postgres-history-upgrade.ts` 在独立库 `irl_r1_test_final45_history_20260927`：旧状态升级至版本 **40–45**，历史快照与个人导出回读通过。
- `scripts/verify-postgres-ai-actions.ts` 在独立库 `irl_r1_test_final45b_ai_20260927`：两连接争同一审批只有一次提交；两个不同已批准提议争同一活动版本为一次提交、一次 `VERSION_CONFLICT`；执行在审批仍有效时等待活动锁，越过期限后返回 `AI_APPROVAL_EXPIRED`，活动与审批回执均不被误写。初版同版本并发曾在 `irl_r1_test_final45_ai_race_red_20260927` 复现 PostgreSQL `40P01` 死锁；修复后的双池验证通过。
- 独立只读审查以提交 `140d808` 为基线复核新增代码，复现并促成修复并发死锁、到期与成员权限竞态及联系方式穿透；复审未发现仍未修复的阻断问题。审查对象的 AI 核心文件 SHA-256 已另行核对。缺失用户行的通知/昵称行为仍为将来硬删除流程的前置处理事项，当前正式账号停用保留用户行。

## 发布门禁

`pnpm preflight:release` 退出码 1：本地 API 地址不是已登记的公开 HTTPS 合法域名；仍有开发身份与测试 AppID；项目及本机私有配置关闭合法域名校验。独立运营账号、真实值守、目的级保留与删除执行、真实供应商/微信订阅消息、目标环境备份恢复、真机验收和至少三场受控线下活动仍需外部条件与证据。本机合成数据、微信模拟器和 PostgreSQL 验证不代表这些门禁已通过。GitHub 的 PR/CI 结果应在最终上传的远端 head SHA 上单独核对，历史 CI 不自动沿用。
