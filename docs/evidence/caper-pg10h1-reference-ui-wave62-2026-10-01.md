# PG10-H1 原稿恢复 · Wave62

日期：2026-10-01。任务基线由根代理指定为 `8cdd564`。实现者完整读取 `/private/tmp/irl-ui62-reference/pg10_h_1/code.html` 并查看 `screen.png`，读取完整计划与 task-2-brief；本记录只覆盖 release-notes 页面。四页 gap 审计在交接时尚未保存，交由根代理/独立复核者随后对照。

## 改动和原稿几何

| 内容 | 原 HTML token → 当前本页实现 |
| --- | --- |
| 页面外边 / 首卡顶部 | 16px → 32rpx |
| 卡片 padding / radius | 16px / 16px → 32rpx / 32rpx |
| 其余章节间距 | 12px → 24rpx；hero 包装 pb8+下一节 mt12 → 40rpx |
| 顶栏 / 返回及 share/more 触区 | 56px / 44px → 112rpx / 88rpx |
| 顶栏 glyph / share/more / avatar | 24px / 22px / 32px → 48rpx / 44rpx / 64rpx |
| hero 标题 | 22px、28px行高 → 44rpx、56rpx |
| 章节标题 | 17px、22px行高 → 34rpx、44rpx |
| 正文 / chip | 13px、18px行高 / 11px、14px行高 → 26rpx、36rpx / 22rpx、28rpx |
| 章节图形外框 / glyph | 40px / 24px → 80rpx / 48rpx |
| 原摄影 / radius | 144px / 12px → 288rpx / 24rpx |
| 小点卡 / row gap | 12px padding、12px radius / 10px → 24rpx / 20rpx |
| 三列小卡 / 圆形 glyph 外框 | 8px列gap、10px padding / 36px外框、20pxglyph → 16rpx、20rpx / 72rpx、40rpx |
| footer 心形框 / glyph | 48px / 24px → 96rpx / 48rpx |

恢复 source 的 hero glow、32px gradient highlight 圆形、蓝/紫/粉主图形实色外框与阴影、摄影遮罩/角标、小点卡结构、3列说明和 footer。feature 01/02/03 小点卡恢复为 3/2/2；优化区保留现有2条真实说明，不补造原稿的第3条产品修复声明。底部两项可用入口为双列。页内 fixed 状态栏底色 `pointer-events:none`，sticky 顶栏使用原 `statusBarHeight`。原 JS 的真实胶囊+8px避让通过原绑定继续生效；它会压缩标题可用宽度，标题允许省略，不能把原 Web 顶栏无胶囊截图当成完全一致证据。

## 原图与准确图形

本页独占 assets 新增 **23 SVG + 2 JPEG + 2 来源 JSON，27文件，共142008 bytes**。25 个图像引用覆盖全部 SVG/JPEG，无其他页/共享图片依赖。

所有 SVG 均使用原计划官方 `export_symbol.py`，固定 repository commit `bd8cb85bd4bad964fe6918f79665bb40c3a8efef`；准确名称从原 HTML 对应位置恢复。包括 `arrow_back_ios_new`、`ios_share`、`more_horiz`、`person`、`verified`、`event`、`auto_awesome`、`mic`、`graphic_eq`、`stylus_note`、`partly_cloudy_day`、`receipt_long`、`check_circle`、`document_scanner`、`swap_horiz`、`military_tech`、`shield`、`bolt`、`favorite`、`verified_user`、`photo_library`、`build_circle`。`favorite` 在3列与footer分别为 FILL1/FILL0，共23资产。`verified/shield/bolt/favorite` 源指定 FILL1保留，其他FILL0。均仅改 SVG root fill，不改 paths/viewBox；没有字体 fallback 和新增共享 proof 目录。

[图形来源 manifest](../../miniprogram/subpackages/profile/release-notes/assets/material-symbols-sources.json) 记录准确名称、FILL、颜色、原始URL/source SHA256/asset SHA256。现有 Apache-2.0许可沿用。

两张 JPEG 从原 HTML 明确给出的公共 Google URL 获取并逐字节保存，分别 **68054 / 50874 bytes**，HTTP 类型均 `image/jpeg`。未缩放、重压缩、绘制或替换。页面写明场景示意，第一张另明确非真实活动照片；第二张角标使用场景说明，未恢复虚构“6人分摊已就绪”。[摄影来源 manifest](../../miniprogram/subpackages/profile/release-notes/assets/reference-photo-sources.json) 记录完整URL、SHA256、bytes与示意用途。

## R1 事实和交互边界

保留 R1 · 本地测试候选、发布状态/正式版日期待确认说明、字段建议与主办方核实、人工审核、候补/协办、站内通知、签到/费用标记/举报申诉、UI持续还原及真机资源待补。费用边界原正文拆为原稿两点卡，含义保持：费用标记不是付款凭证；举报、屏蔽和本人数据请求有独立流程。第一节第3小点把原关闭清单中的“真实 AI 语音建局与自动订场尚未开放”提前说明，准确 mic 图形仅作原稿装饰，不新增语音功能。

后续方向完整清单、分享按钮元数据、更多菜单、关于/我的返回、发起受控活动/查看我的活动路由全部保留。原稿虚构版本号、更新日期、AI功能、自动支付、成就统计及最新版本按钮没有事实依据，使用现有 R1 文案和两个已有可用入口。独占修改 WXML/WXSS/assets/本证据和本地 task-2-report/progress；不修改 JS、common.wxss、navigation.js、API 或其他页。

## 必要验证与限制

一次资源/XML/本地引用/JS验证完成；最初手写图像总数26的验证断言被纠正为manifest集合推导，产品文件无修复改动。最终命令 exit0：WXML作为带wx namespace的XML可解析；25引用均存在且与23 SVG+2 JPEG的manifest集合相同；SVG source与asset SHA均匹配，去除root fill后结构逐字节序列化相等；FILL核对通过；照片SHA/JPEG签名/原HTML URL来源通过；6个bindtap都能在原JS找到方法，share仍为open-type share。JS SHA256前后相同：`73934228fc72f8f43736942518a89bf08b35ae6421c7564b3d81acf87d6bde4a`。自检摘要保存在 `/private/tmp/irl-ui62-release-selfcheck.json`。

不运行业务/全量套件、微信模拟器、CLI、Git/提交；根代理独占后续 targeted build/几何/可用入口复验及scope diff。不能从本静态检查声称微信已编译或真机验收。字号和几何按原 token 恢复，真实 R1 文案/关闭清单导致自然高度及换行与虚构原文不同；Plus Jakarta Sans 未嵌入、原 Webfont 最终渲染全部轴未验证，不能声称逐像素100%。原 font 的 optical size/weight与固定官方24px轴在实际渲染的视觉差异需由根代理查看，源码provenance和paths本次已核对。

## 根代理整合后的最终快照

前文实现者自检快照保留为交接时证据；随后root定向修正原稿模糊单位及需要的text decode，详见本轮整体运行与独立补充复核。JS未改；最终源码hash如下：

| 文件 | SHA-256 |
|---|---|
| miniprogram/subpackages/profile/release-notes/release-notes.wxml | `5a5b6915a5c64d69654976f3d6ff42dc0d19f42a1f03310bce666cefaad306a6` |
| miniprogram/subpackages/profile/release-notes/release-notes.wxss | `5c700962ac19a3ba7a5adcaa23ac8e0c8424d411bdc5f2977dea1823eb0a1857` |
