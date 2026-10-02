# PG10-D 举报入口目标修正（2026-10-01）

设计基准：`/Users/tsb/Downloads/stitch_design_system_generator (2).zip` 的 `stitch_design_system_generator/pg10_d/{screen.png,code.html}`；同时核对 PG10-E/F/H 的设计与当前页。PG10-D 底部原稿是“前往在线客服与违规举报”，当前 R1 只具备真实举报工单，尚无在线客服。当前小程序按钮已诚实标为“前往举报与求助”，但之前绑定 `goSupport`，点击先进入 FAQ 页，未直接定位举报表单。

本次只修改 `subpackages/profile/privacy-safety/privacy-safety`：底部按钮直接写入一次性 `reportSection` 聚焦意图，再切“我的”的真实举报工单区。已登录时携带当前用户及会话所属、空活动 ID 的报告上下文；未登录时不创建访客工单上下文，由“我的”登录门控继续处理。旧的隐私聚焦意图会被清掉，避免覆盖举报目标。顶栏“帮助与反馈”仍保留原 FAQ 路由。PG10-E 正式协议/PDF、PG10-F 安全清理分类、PG10-H 未公布的官方渠道与备案资料仍没有可信数据，未添加虚构功能或按钮。

定向红绿：新增路由回归先 **0/2**，失败原因是没有 `goReport`；补上按钮与方法后，旧的隐私聚焦覆盖场景 **1/2**，再清理旧聚焦。最终仅执行 `test/miniprogram-caper-privacy-report-route.test.ts`、`test/miniprogram-caper-profile-info-routes.test.ts`、`test/miniprogram-caper-profile-visual.test.ts` 和 `test/pg10-legal-cache.test.ts` 四个相关文件，**27/27 通过**；类型检查与 `git diff --check` 退出码 0。没有运行全量测试或本轮开发者工具实点，不能据此声称 PG10-D 逐像素一致、正式环境或真人工单验收。
