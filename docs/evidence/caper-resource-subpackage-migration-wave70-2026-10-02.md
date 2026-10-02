# Wave 70 活动资源无损移入分包

## 实测问题与最小改动

准确首页图片与原稿样式加入隔离冻结版本后，微信 CLI 预览明确返回 `code:10`：主包 source **2059 KB > 2048 KB**。虽然 CLI 进程 exit0，此门禁记为失败；没有预览或 info 输出，不当作成功。

先前 root 已把只有活动费用页引用的 70,223 B 原图从主包移入活动分包。实际仍超限，因此再将仅由活动签到与分享使用的二维码库 **56,694 B**、签到 helper **1,028 B** 原字节移入 `subpackages/activity/vendor/` 与 `utils/`。图片两处 src、event.js 一个 require、share.js 一个 require 随所属分包更新。二维码 helper 内相对 vendor require 保持原字节；没有调整算法、尺寸、绘制或令牌生命周期。

上述三个资源合计移出主包 **127,945 原始 B**，不能直接当最终 CLI 节省数。哈希、移动路径、原/新导入字面量、保护与门禁记录见[JSON 证明](caper-resource-subpackage-migration-wave70-2026-10-02.json)。主包不可依赖分包模块，因此没有保留反向 re-export。

## 限定验证

- 两个生产 JS 只逆回 require 路径后，与 Wave 69 已提交原文件逐字节一致。
- 22 个既有测试文件仅机械更新导入/stub 路径，原断言和逻辑保持；没有为了样式添加照搬实现的测试。
- 仅运行 `checkin-qr`、`miniprogram-caper-share`、`miniprogram-caper-poster` 三指定文件，**40 / 40** 通过，exit0。覆盖实际二维码矩阵、分享/海报绘制以及账号、版本、隐藏、过期回调保护；未运行其他 19 个适配文件、全量业务或 CI。
- 根在隔离微信工程检查迁移后的实际分享 canvas；对应运行结果汇入本批 focused 证据。二维码像素、邀请码和私有临时导出文件不进入公开证据。

最终 CLI 编译与主包实测由本批 focused 报告记录，未获得最终输出前不写“包体通过”。原稿图片质量、共享字体、其他业务与外部验收边界保持。

## 最终冻结后第二次包体失败与图片路径修正

最终首页与详情冻结模板的 CLI 又明确返回 main **2050 KB >2048 KB**，仍记失败。仅迁出二维码模块不足，真实编译包大小必须由 CLI 门禁判定。只读引用核对找到另外三张 main 图片均只供活动分包使用：PG04-S 63,131 B、PG01 36,028 B、行程/签到/费用共用 60,640 B；全部原字节移入活动分包，不压缩、不替换。event WXML 3 类共9处 src、itinerary.js 单处路径随之更新。逆回三个 src 后完整恢复迁移时 owner 冻结 WXML；逆回行程路径后完整恢复 Wave 69 JS。既有行程测试仅更新一处 expected 图片路径，不新增断言或运行整个套件。

共 6 个图片/模块原始资源移出主包 **287,744 B**。各资源 SHA/bytes、第二次 CLI 失败及四路径替换证明均在 JSON 的 `secondCLIFailureAndAdditionalPhotoMigration`；最终编译、三个新图片实际加载与剩余范围将在 focused 证据记录。

## 最后实测

最终 CLI TOTAL4,058,861 B /main1,939,748 B，2MiB余157,404 B /activity1,163,805 B /profile955,308 B；已通过。迁移后三原图实际授权分支绑定与wx.getImageInfo非零尺寸、实际share canvas160×160均已通过限定SDK。host后续source修正及当前测试clone完整一致性见[本批focused报告](caper-wave70-focused-devtools-2026-10-02.md)。二维码像素与口令仍仅private tmp。
