# 主办移除与成员申诉模拟器验证（2026-09-27）

- 环境：更新后的微信开发者工具 `wechatide` 0.3.11，本地测试 AppID、`DEV_AUTH=1`、隔离 PGlite 库 `.data/host-removal-sim-20260927`。创建一场未来开始的合成邀请制活动及已确认成员，开发身份 `host` 打开活动页，实际输入移除原因并点击“移除并告知原因”。[确认框截图](wechat-host-removal-modal-2026-09-27.jpg)显示被移除账号、原因及本人可申诉提示。
- 自动化接口没有直接点击系统确认框的能力。刷新页面后使用 `wechatide automation_wx_api` 将 `wx.showModal` 的确认结果暂时 mock 为 `confirm=true`，再次通过页面元素实际输入原因、点击移除按钮；随后立即恢复原 API。模拟器运行时回读该成员 `REMOVED`，主办页提示已移除且原因仅本人及运营可见；见[主办页截图](wechat-host-removal-result-2026-09-27.jpg)。服务端 `/events/{id}/registrations` 也回读 `REMOVED`。
- 切换到合成成员 `sim-member` 后，“我的与通知”运行时读到 `REGISTRATION_REMOVED` 站内通知与本人可见的移除原因，外部状态为 `CONSENT_WITHDRAWN`，未声称微信消息送达；[成员原因截图](wechat-member-removal-reason-2026-09-27.jpg)。在成员页实际输入复核说明并点击“就此移除申请复核”，运行时回读申诉 `OPEN`，见[申诉截图](wechat-member-removal-appeal-2026-09-27.jpg)。服务端 `/me/removals` 回读同一原因。本地 API 在验证后停止。
- 相关 `test/registrations.test.ts` 与 `test/api.test.ts` 共 60 项通过、0 失败，覆盖移除权限、幂等、状态更新、本人原因与申诉。该次未修改业务代码。

本次确认动作使用了开发工具 mock，不能作为系统确认框真实点击、正式微信身份、真机或真人运营处理的证据。活动和成员均为合成数据。
