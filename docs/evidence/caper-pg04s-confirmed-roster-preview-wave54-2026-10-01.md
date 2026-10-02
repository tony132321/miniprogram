# PG04-S 已确认成员预览（2026-10-01）

用户 Stitch ZIP 的 `pg04_s/screen.png` 在发布成功活动卡的第三条事实行使用成员圆形字形与人数。现有页面此前只显示人数。本次在该行展示至多两名来自活动页 `confirmedRoster` 的成员字形和显示名，保持服务端 `event.stats.confirmed` 作为人数来源。

显示条件为报名名单读取状态 `READY` 且 `confirmedRoster` 非空。`confirmedRoster` 由已确认报名筛选，再经活动内昵称授权映射生成；未授权者仍以“参与者 N”显示。名单空、无权限或读取失败时，该行只显示当前人数与成局人数，不渲染模拟头像或姓名。没有引入新的服务端接口或按钮。

定向验证：`test/miniprogram-event-resilient-detail.test.ts` 与 `test/miniprogram-pg04s-published-shortcut.test.ts` 合计 **18/18** 通过，覆盖已确认名单与授权昵称边界、发布成功页分享入口；`tsc --noEmit` 与 `git diff --check` 通过。此次未运行全量测试。[隔离微信模拟器复拍](images/caper-pg04s-roster-wave54-2026-10-01.png)在当前已审主办活动显示服务端确认 4 人、两枚安全成员字形和显示名，名单读取 `READY`，页面异常 0；wave52 图是本次成员预览前的画面。无授权名单的回退仅经定向用例验证，真机未验。
