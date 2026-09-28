# R1 服务端业务事件字典

依据 PRD §21.4 建立；原文提到的“配套埋点字典”未随三份需求文件提供。本字典记录当前代码的实际事件范围，不替代尚未提供的正式分析规格。

## 生成与字段

`business_events` 由服务端数据库在同一事务的 `audit` 写入后生成。业务命令失败或回滚时无事件；幂等重试沿用原业务结果，也不会再写一次审计与业务事件。迁移 12 生效之前的审计记录不回填，避免把历史当前版本误写成当时版本。分析人员应将表视为只读事件流，不通过前端点击推断业务成功，也不以默认 DAU 代替 PRD 指标。

| 字段 | 定义 |
| --- | --- |
| `event_uuid` | 与源审计行共用的 UUID；可用于去重和追溯，不含用户内容 |
| `event_name` | 下表的服务端成功动作 |
| `occurred_at` | 审计写入时的数据库时间；对应事务提交后才可见 |
| `user_id_pseudonymous` | 数据库内随机盐与内部操作者 ID 的 SHA-256 十六进制摘要；系统任务为 `NULL`。盐只存于业务库，不进入分析导出；同一库内可关联同一操作者，恢复库须连同盐备份 |
| `activity_id` | 内部活动 ID |
| `version` | 业务动作完成时的活动当前版本；活动审核通过使用所审版本 |
| `source` | `API` 用户请求、`OPS` 独立运营账号、`JOB` 后台任务 |
| `release` | 事件结构所属产品发布线，当前固定为 `R1`；不是部署构建号 |
| `is_test` | 业务动作时服务端保存的活动测试标记；不可由客户端指定 |

`user_id_pseudonymous` 表示**执行动作的人**，并不表示被主办方审核或移除的参与者；单靠此流不能计算这些动作的参与者漏斗，须关联受控业务表。分析表不复制审计 `detail`、活动 `payload`、聊天正文、手机号、照片、精确坐标或邀请口令。直接查业务库仍须受生产数据库权限保护；不能把盐表与事件导出一起共享。更换盐会改变以后事件的用户摘要，应作为分析口径变更处理。

## 当前事件

| `event_name` | 成功条件 / 源审计动作 |
| --- | --- |
| `ACTIVITY_PUBLISHED` | 第 48 版起，邀请制和公开活动当前版本由运营审核通过，源 `EVENT_REVIEW` 且 `decision=APPROVED`；旧版邀请活动的 `PUBLISH` 历史事件保持原样，不回填或改写 |
| `INVITE_REVIEW_SUBMITTED` | 邀请活动提交待审，源 `SUBMIT_INVITE_REVIEW`；不代表对外发布 |
| `INVITE_REVIEW_REJECTED` | 邀请活动当前版本审核驳回 |
| `PUBLIC_REVIEW_SUBMITTED` | 公开活动已提交待审，源 `SUBMIT_PUBLIC_REVIEW`；不代表对外发布 |
| `PUBLIC_REVIEW_REJECTED` | 公开活动当前版本审核驳回 |
| `REGISTER_REQUESTED`、`REGISTER_CONFIRMED`、`REGISTER_WAITLISTED`、`REGISTER_INTERESTED` | 报名状态成功写入；发布时主办方本人占位也产生 `REGISTER_CONFIRMED`；`CONFIRMED` 不是实际到场 |
| `CANCEL_REGISTRATION`、`REMOVE_REGISTRATION`、`RESERVE_SEATS`、`CLAIM_RESERVATION`、`ACCEPT_OFFER`、`APPROVE_REGISTRATION` | 对应席位、报名或候补状态已变更 |
| `MATERIAL_CHANGE`、`EDIT_EVENT`、`RECONFIRM`、`CONFIRM_EVENT`、`CANCEL_EVENT` | 对应活动状态或版本动作已提交 |
| `CHECK_IN`、`REQUEST_MANUAL_CHECKIN`、`CONFIRM_MANUAL_CHECKIN`、`REJECT_MANUAL_CHECKIN` | 到场证据动作；`CHECK_IN` 只在首次写入扫码证据时产生，换幂等键重复扫码不重复计数；申请人工补记不等于确认到场，已被已有签到覆盖的人工补记不产生 `CONFIRM_MANUAL_CHECKIN` |
| `COMPLETE_EVENT`、`OUTCOME_FEEDBACK` | 主办方结项或非主办方独立反馈已写入；单个事件不等于 WQCA 达标 |
| `FORMATION_EXPIRED`、`CANCEL_SHORTFALL` | 截止任务导致的活动状态变化 |
| `SAFETY_HOLD_PLACE`、`SAFETY_HOLD_RELEASE` | 单场运营风险暂停或解除 |
| `SHARE_INTENT` | 主办方在活动可招募时生成一条分享来源；不表示卡片已发出或送达 |
| `SHARE_OPEN_ATTRIBUTED` | 已登录且非分享者首次用有效邀请和匹配来源打开；同一来源、邀请和账号只记一次 |
| `SHARE_OPEN_UNKNOWN` | 已登录且非主办方首次用有效邀请打开，但未提供匹配的来源；同一活动、邀请和账号只记一次 |
| `RECORD_EXPENSE` | 主办方成功创建或修订一版 AA 费用记录；不包含金额，也不表示平台收款 |
| `EXPENSE_PARTICIPANT_HANDLED`、`EXPENSE_HOST_RECEIVED` | 参与者本人或主办方的对应费用标记确实发生变化；事件不包含标记值，不能单独据此判断最终处理状态或付款 |
| `CREATE_REPORT` | 与本活动关联的举报已写入；不包含类型或描述，无活动 ID 的举报不进入本活动事件流 |
| `OUTCOME_REVIEW` | 运营人员对活动结项争议作出带结论的人工裁决并结案；不包含裁决值、理由或举报正文，详情留在受限业务表与审计 |
| `RECORD_SUPPORT_MINUTES` | 具授权运营账号记录一笔活动人工时间；事件不包含分钟数，汇总人工时间应读受控业务表 |
| `CONTENT_QUESTION`、`CONTENT_ANSWER`、`CONTENT_ANNOUNCEMENT` | 活动成员或主办方成功提交一条待审内容；事件不包含正文，也不表示审核通过或已对成员展示 |
| `UNKNOWN_FACT_QUESTION` | 当前活动事实与已审核内容均不能回答时，成功创建一条人工待办；同题现存待办不重复计入 |
| `MODERATE_APPROVED`、`MODERATE_REJECTED` | 运营人员对一条活动内容完成审核；事件不包含正文或驳回理由，状态须从受控内容表读取 |
| `OPEN_NOTIFICATION` | 用户首次打开一条关联活动的站内通知；同一条通知以不同请求键再次打开不重复计数，不表示外部消息投递 |

迁移 31 起新增上述分享事件，不回填旧打开记录，避免把迁移时间或当前活动版本伪装成历史打开时间。匿名访客因缺少可安全去重的身份，不计入两类新打开；来源未知可能包含无来源、无效来源或已换链的旧来源。相同访客先未知后有来源会在两类中各有一次，不能把两类相加视为去重人数。迁移 34 起新增费用、活动举报和人工时间动作；迁移 39 起新增结项人工裁决，均不回填历史审计。迁移 48 起邀请活动亦须审核，提交和驳回用独立事件名；首次可访问发布改以批准时间为准，迁移前邀请活动仍按当时的活动版本时间保留历史指标口径。迁移 55 起补充活动内容、事实待办、内容审核和站内通知首次打开事件，不回填旧记录。草稿、普通页面曝光/点击、外部消息尝试、无活动 ID 的举报、申诉及隐私请求仍未进入此按活动索引的业务事件表；它们的服务端原始记录仍在业务表或审计表。跨流程全量埋点和正式实验事件字典仍需补齐。收入、支付成功或预约成功没有提供方证据，绝不产生对应成功事件。
