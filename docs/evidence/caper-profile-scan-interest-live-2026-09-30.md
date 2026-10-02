# PG10-A 扫码与兴趣入口（2026-09-30）

对照 Stitch `caper_1` 和 `pg10_a_edit_profile`，个人页顶部扫码图形已改为按钮。点击时说明现场签到只属于已确认报名或正在主办的活动，确认后进入读取本人真实活动的“我的行程”，由用户选中相应活动进入签到区。个人兴趣没有 R1 保存接口，因此入口改为“了解兴趣标签／查看说明”，打开资料页的兴趣说明区，不再承诺编辑。

## 微信开发者工具隔离项目实点

- 主办测试身份点击扫码图标并确认后到达 `subpackages/activity/itinerary/itinerary`，本人活动列表 `READY`、异常 0：[真实行程入口](images/caper-profile-scan-itinerary-live-2026-09-30.png)。这里验证的是入口和活动选择，没有调用真机摄像头。
- 点击“了解兴趣标签”后到达 `subpackages/profile/profile-edit/profile-edit?focus=interests`；页面自动定位到明确写着不能选择或保存的兴趣说明区，异常 0：[兴趣说明区](images/caper-profile-interest-info-live-2026-09-30.png)。

相关聚焦测试 **28/28**，本页与首页第一版合并时全量测试 **842/842**、类型检查、差异检查及微信开发者工具 CLI `preview`（2,103,423 Byte）通过。之后首页的一处登录竞态窄修已通过相关 **112/112**；最终全量以新 GitHub CI 为准。根代理另在开发者工具实点并检查页面源码。真机扫码仍需要正式设备和活动环境。
