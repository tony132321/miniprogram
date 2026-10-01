# PG10-F 官方字形恢复 · Wave 61

日期：2026-10-01。实现范围：`miniprogram/subpackages/profile/cache/cache.wxml`、`cache.wxss`、本页 `assets/`。已完整阅读三页计划、Wave61原稿差距审计及Task2 brief，并查看 `/private/tmp/irl-ui61-symbol-audit/pg10_f/code.html` 与780×1600原PNG。未修改业务JS、共享样式或导航。

## 字形及尺寸

| 位置 | 原名字 | FILL | 颜色 | 显示尺寸 |
| --- | --- | --- | --- | --- |
| 返回 | arrow_back_ios_new | 0 | #1a1b1f | 48rpx |
| 更多 | more_horiz | 0 | #1a1b1f | 44rpx |
| 头像内图 | person | 0 | #ffffff | 36rpx |
| 统计标题 | storage | 0 | #1d64f2 | 36rpx |
| 设备状态 | auto_awesome | 1 | #5856d6 | 44rpx |
| 本地说明首项 | photo_library | 0 | #1d64f2 | 44rpx |
| 账号说明 | forum | 0 | #5856d6 | 44rpx |
| 保护说明 | verified_user | 0 | #34c759 | 40rpx |
| 重新读取装饰 | cleaning_services | 0 | #ffffff | 40rpx |
| 实际读取时间装饰 | check_circle | 0 | #737687 | 28rpx |

所有图片使用 `mode="aspectFit"`，官方路径来自固定提交 `bd8cb85bd4bad964fe6918f79665bb40c3a8efef`，仅SVG根fill改变；本页 `assets/material-symbols-sources.json`逐项记录URL、FILL、色值、原文件和交付文件SHA256。十个准确名字均直接获取成功，无字体回退。固定轴为Outlined/wght400/GRAD0/opsz24；未声称与原Webfont最终计算轴完全一致（源返回另有font-semibold）。SVG合计3731字节。

删除CSS人像、盘位盒、手机、证件框、文件、盾形及刷新箭头的替代轮廓。保留原卡片、圆形外框、实际读数几何；返回触区88rpx=44px；头像外圆64rpx=32px底色改为源primary #004cc8。增加页内固定状态栏底色遮罩，仍按实际statusBarHeight及headerPaddingRight避让。

## 真实功能边界

`refreshStorage`继续只读取微信本机统计。READY数值、百分比、实际lastReadAt、UNAVAILABLE的`--`及失败文案、隐私入口均保留。扫帚为原稿装饰，按钮标签仍为“重新读取设备存储”。未增加清理选择框、清理确认sheet、删除动作或成功toast，未恢复静态12.4MB、原2024时间、AI诊断/在线承诺。

## 本次验证

一次必要资源检查通过：10个SVG XML解析、source/asset SHA256、与官方原文件所有子节点属性及path完全一致、根fill及本地WXML引用一致；cache.js无差异；READY/UNAVAILABLE/读取时间/refreshStorage绑定及关闭边界静态检查通过。`git diff --check`针对本页WXML/WXSS通过。未新增镜像测试、未跑全量或业务套件、未操作模拟器、未提交。模拟器顶栏/实际读数/刷新/失败状态及隐私实点由根代理整合复核；不据源码资源检查宣称39屏逐像素或真机/上线验收。
