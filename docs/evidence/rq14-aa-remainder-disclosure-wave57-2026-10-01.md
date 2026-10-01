# RQ14 AA 尾差事前说明（2026-10-01）

## 来源与改动

v3.1 源输入 `Project_IRL_Autonomous_Engineering_Package_v3.1/01_PRD_v1.0.md` 第 253 行要求按确认人数以整数分等分、总额一致，并在事前说明尾差规则。本批从候选 `f17364a94f8bd968026b37254ba61e930f05be37` 的既有费用实现补充文案。

`src/lifecycle.ts` 的 `recordExpense` 只选当前 `CONFIRMED` 报名者，按 `user_id` 固定排序；每人先分得 `floor(totalFen / 人数)`，余下几分分给顺序靠前的成员，每人增加 1 分。该技术排序依据只在工程证据中说明，页面使用“固定成员顺序”。

仅修改 `miniprogram/pages/event/event.wxml` 的两处文字：

- 主办工作台的 AA 金额输入与“记录／修订 AA 分摊”按钮之间，说明按记录时已确认成员人数等分，分到尾差的成员各多分摊 0.01 元，各人份额合计等于总费用，个人金额以当前账单的分摊明细为准。该说明在新增与修订动作前均可见于模板。
- PG09 费用记录说明区使用同一分配规则，保留非平台支付／资金托管、双方声明不一致需线下核对及修订后重新确认的说明。

未修改分摊算法、JavaScript、接口、账本版本、名单权限或测试；源输入包不纳入代码变更。

## 定向验证

使用桌面工具返回的 Node 路径执行现有用例：

```sh
/Users/tsb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --import tsx --test --test-isolation=none --test-concurrency=1 --test-name-pattern='AA expense split stays in integer fen and does not claim payment' test/lifecycle.test.ts
```

退出码 **0**，**1/1** 通过、失败 **0**。该用例以 10001 分和三名确认成员验证份额总和为 10001 分，并验证 `RECORD_ONLY`、参与者仅见本人份额、本人处理与主办收到的独立声明以及其他成员不能伪造主办收到记录。它没有逐人断言尾差排序；本批对文字与现有固定排序算法的对应关系采用源码核对。

`git diff --check` 退出码 **0**；差异核对确认两处说明和本记录为本批变更。

本批没有运行全量测试、共享模拟器或真机；没有新的 CLI 包体或页面截图。说明区增加的文字高度须随完整小程序同步后统一复核，本记录仅作为源码和定向代码验证证据。
