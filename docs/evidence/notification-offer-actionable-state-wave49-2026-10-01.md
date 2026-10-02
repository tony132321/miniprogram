# RQ08／RQ12 补位通知可操作状态对齐

## 范围

`listMemberNotifications` 原先只看补位 offer 是否有效、活动审核和风险／公开挡板。活动停止招募、取消、报名截止后，或报名行／活动版本变化时，旧通知仍可能把“主动确认补位”标成可操作；实际 `acceptOffer` 会拒绝。客户端直接使用返回的 `actionable`、`declinable` 和通知版本显示按钮并提交请求。

本批仅调整 `src/notifications.ts` 的补位通知列表计算，并新增 `test/notification-offer-actionable-state.test.ts`。`actionable` 现在同时核当前活动招募状态、报名截止、当前版本、offer 与报名行、风险暂停、全局开关及公开活动值守开关；`declinable` 只核实际拒绝接口所需的有效 offer、本人 OFFERED 报名及版本，不因活动暂停招募、取消或报名截止而隐藏拒绝入口。

## 定向验证

- 新测试先红：停止招募时实际返回 `[true,true]`，期望 `[false,true]`。
- 修改后新测试 **1/1** 通过，覆盖停止招募、取消、报名截止、报名行状态、版本变化，并实际验证停止招募下接受返回 `OFFER_UNAVAILABLE`、拒绝仍成功。
- 相邻 `test/notifications.test.ts` **19/19** 通过，包括风险暂停后仍可拒绝、公开招募关闭后的挡板、邀请制不受公开开关误伤。
- `tsc --noEmit` 和 `git diff --check -- src/notifications.ts` 通过。

这属于本地服务端状态提示验证；读取后至点击前状态仍可能变化，最终结果以补位写入接口为准。本批未运行全量测试、微信开发者工具、真机或目标环境。
