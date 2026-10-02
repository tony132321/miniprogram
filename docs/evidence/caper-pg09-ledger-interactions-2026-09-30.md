# PG09 AA 账本客户端交互（2026-09-30）

对照用户 ZIP 的 `pg09`，费用页在已授权的 `GET /events/:id/expenses` 响应上增加“查看／收起明细”、超过 4 条可见分摊时“展开／收起成员”、按 `amountFen` 稳定降序／恢复接口顺序。切换只改变本地显示，不调用费用写入 API；换身份会清空旧账本。普通成员接口只返回本人分摊，因此页面标为“我的份额”，不把可见行数冒充整场人数，单行不提供排序。

定向测试 `test/miniprogram-event-expense-interactions.test.ts` 使用包含 5 条服务端返回分摊的账本核对展开、排序及单账本作用域，3/3 通过；PG05 深链旧测试已调整为当前聚焦视图“切换分区并滚到顶部”的行为，5/5 通过。CLI `preview` 编译当前合并工作区成功，总包 1,801,458 Byte。

开发者工具以测试 AppID、本地 API、合成主办身份打开真实活动 `74716b6d-3a87-40b6-91b8-9117fa354bde` 的费用分区，回读 `loadState=READY`、`activeSection=expenseSection`、`expenseLoadState=EMPTY`、`expenses.length=0`；截图：[PG09 真实空态](images/caper-pg09-empty-interactions-2026-09-30.png)。随后在[隔离三状态场景](caper-three-state-isolated-devtools-2026-09-30.md)中实点非空 5 行账本的明细、排序和成员展开，页面与 API 金额及行数一致；成员另以历史 AA 场景实测只见本人 1 行。

原稿中的商户收据、AI 费用拆分、平台支付与已清账断言没有对应 R1 接口，页面明确保持“仅作 AA 记录”。正式 AppID、HTTPS、真机和真人活动不在本证据范围。
