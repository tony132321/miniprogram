# 用途级保留策略启动配置

候选和生产阶段在连接数据库前读取 `RETENTION_POLICY_JSON`。开发包的 `ops/retention_policy.json` 是未批准提案，不能直接用于启动。配置应由数据负责人完成逐类决定并留存实际审批材料，再由部署密钥管理系统注入 JSON；代码只能校验格式和必填项，不能核实审批者身份、法律依据是否充分或删除任务是否已执行。

顶层字段：

- `schema`: `project-irl/retention-policy-v1`
- `status`: `OWNER_APPROVED_FOR_REAL_DATA`
- `approved_by`: 实际批准负责人标识；`approved_at`: ISO 时间
- `records`: 恰好覆盖 `voice_raw`、`unneeded_draft_input`、`photo`、`ordinary_profile`、`dispute_or_required_logs`、`backup` 六类。不得合并为一个全库 TTL 或重复类别。

每个启用类别要求 `status: APPROVED`、正整数 `approved_days`（最多 36500）或明确的 `approved_trigger`、非占位的 `legal_basis`、`deletion_action` 与至少一个 `access_roles`。首版未启用的 `voice_raw`、`photo` 可使用 `status: NOT_ENABLED`；其余四类不得如此标记。具体值由负责人决定，仓库不提供可直接上线的批准样例。

此闸门只阻止缺失或明显未批准的策略配置。T32 的实际删除与去标识执行、争议保留隔离、到期清理、备份轮换和恢复后删除标记重放仍需实现和演练；配置通过不代表真实数据已获发布许可。
