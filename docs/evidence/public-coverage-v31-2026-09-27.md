# 公开活动具名值守闸门：本地代码与 PostgreSQL 证据

来源：v3.1 开发包 T29/T35 `AC-SAFETY-COVERAGE`。沿用现有公开招募总开关、运营 `SAFETY` 权限、审计和持久通知任务。此记录只证明代码在合成数据下的行为，不证明真人值守、实际演练或公开发布条件已满足。

## 实现范围

- 第 43 版迁移新增具名值守时段、演练引用、独立复核、撤销记录；旧版 `OPEN` 在迁移时收束为 `CLOSED` 并留系统审计。初始数据库同样为有效关闭状态。
- 当前具名班次必须已开始、未结束且被另一安全运营确认；每场公开活动还须有覆盖完整起止时间的已确认班次。缺任一条件，公开详情、邀请、发布、审核、报名、占位和候补外发立即拒绝；邀请制活动、成员退出和举报保留。
- 撤销当前班次关闭总开关并入队原有站内通知。撤销活动时段班次时，仅对因此失去全部覆盖的已批准活动给主办与现有参与者入队关闭通知，并写活动审计；私密撤销原因不进入通知正文。到期后读取和写入实时失效，即便工作任务尚未执行、旧数据库行仍记为 `OPEN`；到期任务随后用数据库时钟关闭总开关、审计并通知，换班后旧任务不误关新班次。
- 运营台可记录班次与演练引用、由第二名安全运营复核、输入记录 ID 开放总开关，以及撤销班次。运营身份由登录会话确定，客户端填写的责任人不会覆盖会话身份。

## 本地验证

- `pnpm exec tsx --test test/public-coverage.test.ts test/public-gate.test.ts test/operator-ui.test.ts`：**56/56 通过**。覆盖初始关闭、缺覆盖拒绝、未来开始/到期边界、完整活动时段、单场及当前班次撤销、成员退出举报、旧候补外发、到期自动关闭及换班旧任务跳过、通知入队和运营台脚本操作。
- `pnpm typecheck`：通过。
- 本机 PostgreSQL **18.6**、`127.0.0.1:55432`、仅 `irl_r1_test_*` 隔离库：最终候选的 `scripts/verify-postgres.ts` 在 `irl_r1_test_final44_a_20260927` 退出码 0，输出 `migrations:44`、`pools:2`、`eventCoverageRevokeCrossPool:true`。早期验证发现 PostgreSQL 微秒时间经 JavaScript `Date` 回写会丢失精度；通知与审计已改为直接读取数据库 `revoked_at`，最终双连接池再次通过。
- 到期作业追加后，在新的 PostgreSQL 18.6 隔离库 `irl_r1_test_public44_expiry_job_20260927` 直接调用服务和 worker，退出码 0，回读 `migration:44`、`scheduledExact:true`、`expiredClosed:true`；该单点验证不代替最终全链路双池重跑。
- `scripts/verify-postgres-public-coverage-upgrade.ts` 在 `irl_r1_test_public43_upgrade44_20260927` 退出码 0：重建合成第 42 版 `OPEN` 状态，升级后为 `CLOSED`，有 `system:migration-0043` 审计，且无覆盖时函数返回 false；随后连续应用至第 44 版。
- `scripts/verify-postgres-history-upgrade.ts` 在 `irl_r1_test_public44_history_20260927` 退出码 0：版本 40–44 的历史升级和旧记录回读通过。

## 尚需外部证据

测试记录的责任人、复核人、演练引用均明确为**合成**；无法代替真实人员排班、独立账号发放、演练记录、响应时效、目标环境部署、微信真机或三场受控真人活动。到期作业取决于后台 worker 按时运行；worker 延迟时读写仍实时失效，但站内通知会延迟。最终候选 `pnpm test` **460/460**、`pnpm typecheck`、依赖高危审计及本机 PostgreSQL 双池验证通过；`pnpm preflight:release` 因正式配置缺失未通过。
