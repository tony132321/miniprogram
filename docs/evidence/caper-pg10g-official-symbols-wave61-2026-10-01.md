# PG10-G 官方字形恢复 · Wave 61

日期：2026-10-01；原稿 `/private/tmp/irl-ui61-symbol-audit/pg10_g/code.html` 全文及 `screen.png` 已读取／查看。以 Wave61 审计和计划为绑定范围。

本页新增 `support/assets/` 12枚官方 Material Symbols Outlined SVG 与来源 manifest，原始 glyph paths 不变，仅修改 SVG 根 fill。所有资源来自固定提交 `bd8cb85bd4bad964fe6918f79665bb40c3a8efef`，本页没有404或静态字体回退。固定轴为 wght400／GRAD0／opsz24；未验证原浏览器动态字体所有轴，不能宣称原稿逐像素一致。

| 本地资产 | 精确原名 | FILL | 颜色 | 显示 px / rpx |
| --- | --- | --- | --- | --- |
| arrow-back | arrow_back_ios_new | 0 | #1a1b1f | 24 / 48 |
| more | more_horiz | 0 | #1a1b1f | 22 / 44 |
| person | person | 0 | #ffffff | 18 / 36 |
| smart-toy | smart_toy | 1 | #ffffff | 26 / 52 |
| chat | chat | 0 | #ffffff | 18 / 36 |
| agent | support_agent | 0 | #5856d6 | 18 / 36 |
| help | help_center | 0 | #1d64f2 | 20 / 40 |
| expand-more | expand_more | 0 | #737687 | 20 / 40 |
| edit | edit_note | 0 | #5856d6 | 20 / 40 |
| photo | add_photo_alternate | 0 | #737687 | 26 / 52 |
| contact | contact_phone | 0 | #737687 | 20 / 40 |
| send | send | 0 | #ffffff | 20 / 40 |

删除机器人 CSS 脸／天线／眼嘴，FAQ 字符箭头换官方图片，保留原 `is-open` 180°旋转和 `toggleFaq` 绑定。全部图片明确尺寸与 `mode="aspectFit"`。返回触区恢复88rpx（44px）；头像圆底收敛为原稿 #004cc8，保留64rpx（32px）圆容器；增加随 `statusBarHeight` 的固定不透明安全区底色，头部动态胶囊避让仍采用既有 `headerPaddingRight`。

迁移前 `rg -n 'assets/stitch/pg10g' miniprogram` 确认8枚main包旧手绘图只有 support WXML 消费；迁移后全miniprogram无这些引用，删除8枚sole-consumer旧资产。没有修改业务JS、共享CSS或导航。

必要资源检查已通过：12枚SVG解析、实际本地引用存在、asset/source SHA-256与manifest匹配、官方源子节点属性（glyph paths）完全相同、根fill准确；5处disabled控件保留。AI／人工客服／反馈发送／截图上传／联系方式继续关闭；四条真实FAQ、发起／举报／关于／我的绑定不变。额外真实举报 `!` 保留原适配字符，未声称是PG10-G原图标。未恢复schedule工作时间装饰、在线点、响应时间或成功toast。

未运行全量／业务套件、样式镜像测试、微信CLI或模拟器，没有提交。实点和整合包体检查交由根代理；本报告是源码／官方资源证据，不能提升为真机、39屏逐像素或上线验收。
