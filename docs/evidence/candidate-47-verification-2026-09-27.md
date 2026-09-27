# R1 第 47 版代码候选核验

日期：2026-09-27。候选在现有 R1 工程上增加第 46 版举报首次响应留痕与第 47 版删除申请即时保护；未改变正式 AI、审核供应商或真实微信配置的关闭状态。

## 本地自动化与审查

- 在项目目录使用工作区提供的 Node.js 24.19.0，`pnpm test` **496/496 通过**、失败 0（日志 `/tmp/project-irl-r1-v47-full-tests.log`）；`pnpm typecheck` 退出 0；`pnpm audit --audit-level high` 返回 `No known vulnerabilities found`；`git diff --check` 退出 0。
- 第 46 版的定向测试覆盖高危改级陈旧页面冲突、最终写入跨响应截止、已逾期降级拒绝、旧安全工单优先、已响应工单排序、权限与正文隔离。第 45 版旧库中已处理工单真实升级到第 46／47 版后，保留 `LEGACY_UNKNOWN`，结案不伪造首次响应时间；迁移校验值也回读核对。
- 第 47 版定向测试覆盖新 DELETE 申请原子撤回授权及昵称、旧幂等键补保护、旧申请启动补保护、重复运行幂等、失败整笔回滚、原有外部发送及授权／昵称／再约挡板。
- 两条变更分别经独立只读审查，未发现当前候选阻断。审查指出的举报排序、历史状态、时钟临界及旧页面覆盖问题已在本候选修复。
- [更新后微信开发者工具 PG10 复测](wechat-privacy-delete-protection-47-2026-09-27.md)使用合成开发身份实际点击“申请注销或删除”；页面与本地 HTTP 回读相同的 `PROTECTED_PENDING_POLICY`、授权撤回 2 项及昵称移除 1 项。两张页面截图留存于同目录。该证据不代表正式微信登录或真机。

## 本机 PostgreSQL

本机 PostgreSQL 18.6 的全新空测试库 `irl_r1_test_privacy47_20260927_a`、两个独立连接池运行 `scripts/verify-postgres.ts`，退出码 0。输出确认 `migrations:47`、`pools:2`、`reportResponseLockDeadlineCrossPool:true`、`privacyDeleteProtectionCrossPool:true`、`privacyDeleteSendLockCrossPool:true`；原有 100 人竞争等检查亦通过。真实行锁测试覆盖发送中的最终共享锁与 DELETE 申请顺序、高危工单等候行锁跨截止，以及跨池读取保护回执、撤权、昵称撤销和重复提交无重复历史审计。

## 发布边界

`pnpm preflight:release` 退出 1：尚无已配置的公开 HTTPS 合法域名、正式 AppID 与主体核验，开发身份仍在，本机和项目配置的合法域名校验未开启。微信真机、订阅模板与送达、真实值守和三场受控线下活动均未验证。第 47 版的 `PROTECTED_PENDING_POLICY` 只表示已阻断通知／推荐／昵称并撤回相关授权；实际资料删除、去标识、争议资料保留期限及备份恢复后的删除标记重放仍待数据负责人批准策略与目标环境实现。
