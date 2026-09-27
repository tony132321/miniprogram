# 报名截止前人工审批成功（2026-09-27）

- 复用现有人工审批实现和小程序活动详情页。在更新后的微信开发者工具 `wechatide` 0.3.11、本地测试 AppID、`DEV_AUTH=1` 与隔离库 `.data/manual-approval-success-20260927` 中创建一场未来开始的邀请制合成活动，报名方式为 `MANUAL`。成员 `manual-member` 申请后，服务端与主办页面均回读 `REQUESTED`、`accepted_version=null`。
- 主办身份 `host` 在模拟器中**实际点击**该申请的“同意申请”按钮，没有 mock 按钮或确认结果。页面回读“已审核报名”，成员状态变为 `CONFIRMED`、接受活动版本 2；见[主办页面截图](wechat-manual-approval-success-2026-09-27.jpg)。成员接口 `/me/registrations` 返回相同状态。切换至成员身份后，活动页 `myRegistration.status=CONFIRMED`、`accepted_version=2`，见[成员页面截图](wechat-manual-approval-member-2026-09-27.jpg)。随后恢复本地 `host` 测试身份并停止 API。
- 截止后拒绝路径和检查到写入间的时钟竞争仍由[既有验证](manual-approval-deadline-2026-09-26.md)覆盖；本次 `test/registrations.test.ts` 28 项通过、0 失败。未修改业务代码。

这是本地合成数据和模拟器交互；正式微信身份、真机、真实活动以及目标环境 PostgreSQL 时钟竞争未在此轮验证。
