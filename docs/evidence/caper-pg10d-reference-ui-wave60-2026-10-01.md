# PG10-D 原稿恢复 · Wave 60（2026-10-01）

对照 `caper-pg10d-e-visual-gap-audit-wave60-2026-10-01.md` 全文及原缓存 `pg10_d/code.html`、已查看的 `screen.png`，本页局部恢复原稿明确 token。375px 时 1px=2rpx：16px页侧距、56px顶栏、44px返回/更多触区、32px头像、12px卡圆角、16pxhero内距、40px圆/22px填充盾心、标题17/22px与副文11/14px。说明点列为13px/1.625、6pxCSS圆点、8pxgap，首行没有重复margin。

列表标题17/22px，hero后16px、标题后8px。匿名成员行恢复48px头像与16px粉色block徽标、15/20px名称、11/14px标签、13/18px真实活动来源，解除触区至少38px高、13/16px文字。列表行间8px。READY真实空数组使用无白卡空态：纵40px内距、64px绿色圆/32px verified_user、17/22px标题和13/18px描述。举报卡采用32px粉圆/18px警示符号、12px内距、8pxgap、13px正文/链接。

SVG来自根代理核定Google Material Symbols仓库固定提交 `bd8cb85bd4bad964fe6918f79665bb40c3a8efef`。本页独占 `privacy-safety/assets/material-symbols-sources.json`记录源URL和hash；保留官方path，只调整fill。shield_with_heart为FILL1，其余为默认FILL0。原PNG盾心缺字，采用HTML明确轮廓恢复。报告符号report_problem官方旧名路径404，由根代理核定兼容官方符号后补充记录。没有外链字体下载；声明Plus Jakarta Sans并使用现有系统中文回退，未证明字体在设备上安装。

业务JS未改；GET、撤回POST、ready等待、generation和旧身份校验、未登录/加载/错误状态、处理中禁用、匿名名称/真实eventTitle、更多菜单/我的/帮助/说明/举报目标全部保留。没有虚构姓名、照片、屏蔽日期或原因。

执行相关既有检查：`node --import tsx --test test/pg10-profile-navigation.test.ts test/miniprogram-caper-privacy-report-route.test.ts`，12项通过，无失败。没有新增测试、全套测试、共享模拟器、截图或真机操作；源码恢复不等于最终1:1验收。根代理独立复核图标最终来源、CLI与模拟器实点/截图。

## 集成补充：原稿 report_problem

固定 SVG 目录不存在该旧图标名。根代理从 Google Fonts 官方静态子集提取原稿 `report_problem` 连字；GSUB 精确对应 `uniE002`，原路径未经描形修改，采用 SVG 字体坐标翻转与原稿色值。独立复核已确认字形映射、字体字节、路径和散列；来源、字体版本及独立于固定 SVG commit 的边界记录于 `docs/design-sources/material-symbols-report-problem/`。现在所有引用均有本地资源，无近似替代。此补充仍不代表模拟器或真机绘制通过，整合结果见本批总证据。
