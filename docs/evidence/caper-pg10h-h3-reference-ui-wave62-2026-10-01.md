# PG10-H About／H3 Open-source 原稿恢复证据（Wave 62）

日期：2026-10-01。实现范围只含 About 和 Open-source 的 WXML、WXSS 与页面独占 assets；任务本地记录位于 `.superpowers/sdd/2026-10-01-pg10-h-reference-ui/task-1-*`。原基线由根代理指定为 `8cdd564`，本实现者没有运行 Git、提交、微信 CLI、模拟器或全量／业务测试。

## 已读输入

完整读取 `docs/superpowers/plans/2026-10-01-pg10-h-reference-ui.md`、本地 Task 1 brief 和独立四页审计 `docs/evidence/caper-pg10h-reference-gap-audit-wave62-2026-10-01.md`。独立读取两份完整原 HTML、查看两张 PNG，原始路径为 `/private/tmp/irl-ui62-reference/pg10_h_project_irl/` 和 `/private/tmp/irl-ui62-reference/pg10_h_3/`。PNG 宽分别514、348，不把原长图像素当375px设备尺寸；实现按HTML明确单位375px=750rpx。

| 原稿 | HTML SHA-256 | PNG SHA-256 |
|---|---|---|
| H | `e29a2c86dc0f3584009a8b37268fba472325ff5f748c65df4e886881a815bad9` | `eaa063182ba0a61e2a7b7d0cc649d24730a6152557cfd063a9c8bd62ebed6a1d` |
| H3 | `1375e6dbe0acb545c85553314dbea919eee7b8054136e149074ddae612089b0a` | `29afed29a2d39bd2636199f41ef6848b00802ebf648d5bcdeccc754b6f46b362` |

## About 恢复

- 16px页边，56px sticky头部，返回44px触区（本稿左对齐）、更多44px触区、32px头像和源 `primary #004cc8`。返回24px、更多22px、person18px使用精确官方SVG。固定状态栏底色，`pointer-events:none`；继续使用现JS实际胶囊+8px避让、状态栏值。菜单位置随56px头部恢复，绑定未改变。
- **Infinity Spark** 直接提取原HTML SVG：96px外框／26px圆角／2px蓝→primary→紫渐变边，24px内圆角，56px显示尺寸，64×64 viewBox，8px绿色角点／8px偏移及glow。品牌字28px／36px800、顶部12px。蓝192px／青柠128px光晕及其原透明度与模糊恢复。Logo内层保留白底，透明装饰渐变不会透出外框蓝色。
- 原SVG的Mobius path、spark path、circle、所有坐标、线宽、defs、三个渐变色和未引用的`sparkGlow`定义保留。作为独立XML需把`viewbox→viewBox`、`lineargradient→linearGradient`、`gradientunits→gradientUnits`、`fegaussianblur→feGaussianBlur`、`stddeviation→stdDeviation`、`fecomposite→feComposite`规范大小写；去HTML class并补SVG namespace。没有给path追加原本未引用的filter，没有重画。`reference-logo-sources.json`记录原HTML与最终资产hash。
- 宣言16px padding／16px圆角、32px心形盒／18pxfavorite；右下原80px `format_quote` 图形、opacity0.1、right/bottom -12px；17px引用与13px正文恢复。原理念引文和现R1真实正文保留。
- 三行40px图盒／12px圆角、22px准确glyph、17px主字／13px次字、16px行padding／12px图文gap／分割线左56px。3枚精确 `arrow_forward_ios`，不是chevron同义替换。
- 渠道卡16px padding、36px圆形／20px图形、13px标题／副字；精确 `chat`、`photo_camera`、`forum`。官方账号仍“待公布”，灰色未公布点保留；没有新增账号或官网。底部实际发现／发起按钮按原12px padding、12px圆角、13px字级及18px图形恢复。Footer使用原层级／点装饰与真实候选/主体待核实文案。

About使用**17个不同名字的页面独占Material SVG，19个展示实例**，全部FILL0：`arrow_back_ios_new`、`more_horiz`、`person`、`check_circle`、`format_quote`、`favorite`、`auto_awesome`、`arrow_forward_ios`（3次）、`diversity_1`、`code`、`chat`、`photo_camera`、`forum`、`public`、`open_in_new`、`star`、`group_add`。另1个Infinity Spark SVG；共20个image实例。

内容适配单独说明：源标题`Edit Profile`保留为准确中文“关于 Project IRL”；版本源`check_circle`仅装饰现“功能状态见下方”，没有更新检查或“已是最新”判断。源官网行的`public/open_in_new`现装饰已有公开工程说明内页导航；`star/group_add`装饰已有浏览活动灵感／发起受控活动按钮，不成为评分／共创群入口。原更新定时器、`refresh/done_all`假状态和虚构版本、账号、公司、备案、许可证、在线状态未进入产品。

## Open-source 恢复与真实署名

- 16px页边，正文`#F5F6F8`，首卡上12px；56px sticky头部、44px返回／分享／更多触区，返回居中、32px源primary头像，精确官方glyph。现分享`open-type=share`、菜单、返回／我的页绑定保留。状态栏固定`#faf8fe`底色，实际胶囊+8px避让依旧由现JS计算。
- Intro16px padding、12px圆角、48pxcode盒／26pxglyph、17px标题／11px副字／13px正文；依赖卡12px padding／12px圆角／8pxgap，17px依赖名、13px作者／正文、11px许可标签。源文字`leading-relaxed`位置使用1.625行高；长真实内容按自然高度排版。
- 致谢16px外padding、32pxfavorite浅粉盒／18px图、15px标题／11px副字；内部三块12px padding／8px圆角／12pxgap／13px真实陈述。`celebration/touch_app/diversity_3`精确源名用于新增的通用“测试与反馈／设计参考／项目与贡献记录”小标题装饰；没有引入Partiful、Apple合作或上海参与者的虚构署名。
- 许可摘要恢复源灰色`#e3e2e7`、12px padding／圆角和11px字级；不把原示例通用MIT全文当本工程许可声明。真实仓库地址、`copyRepository`绑定及成功／失败反馈保留，追加本地`open_in_new`图装饰复制动作。
- 实际五项依赖仍是pg、PGlite、TypeScript、tsx、qrcode-generator；新增一项工程已实际使用的Material Symbols本地SVG资源致谢，页面准确计数“5 项依赖 · 1 项图标资源”。许可正文已有`docs/licenses/material-symbols-Apache-2.0.txt`，没有下载或宣称加载Plus Jakarta Sans字体，没有照抄Tailwind UI／Lucide／Confetti／date-fns模板依赖。
- 已安装`node_modules/pg/package.json`证明pg版本**8.23.0**、作者**Brian Carlson**，`node_modules/pg/LICENSE`为MIT且版权行为**Copyright (c) 2010 - 2021 Brian Carlson**。页面把此前误写的PostgreSQL数据库项目署名改为该客户端实际作者，并展示这一实际版权行；没有展示邮箱。其余已有用途/归属文案保留。

H3使用**12个页面独占Material SVG、12个展示实例**，全部FILL0：原11个静态名字 `arrow_back_ios_new/ios_share/more_horiz/person/code/terminal/favorite/celebration/touch_app/diversity_3/gavel`，加仓库复制装饰`open_in_new`。源头部`Expense Breakdown`仍为准确中文开源标题。原“All components verified”、统一工程版权及虚构许可声明未采用。

## 官方资源与一次必要自检

全部29个Material SVG按准确原名从官方固定commit **`bd8cb85bd4bad964fe6918f79665bb40c3a8efef`** 导出，helper `/private/tmp/irl-material-symbols-wave60/export_symbol.py`。没有404或fallback、没有近名替代。每页独占`material-symbols-sources.json`记录source URL、FILL0、颜色、原与资产SHA-256；只改SVG根fill，path未变。管线轴为Outlined／wght400／GRAD0／opsz24；原Webfont最终所有轴未验证，尤其源H返回font-semibold不能声称字体轴逐像素一致。

一次Python资源校验已完成：临时把`wx:`属性规范化后解析两份WXML（文件未因此改写）；全部32个image引用存在且SVG/XML解析成功；29个Material资产hash与manifest、固定源hash及除根fill外XML内容一致；FILL全部0、没有多余或缺失manifest资源；Infinity Spark与原稿经上述XML规范化后的字符串一致，viewBox正确；Apache许可存在；pg版本／作者／版权与安装包一致。只做必要资源验证，没有新增样式镜像测试。

| 页 | 最终WXML SHA-256 | 最终WXSS SHA-256 | JS SHA-256（实现前后相同） |
|---|---|---|---|
| H | `6fdb64d08e2643a289241fe85cfbf47900ffc4f3b36e7dee520bbc1434ad7177` | `0688a236b9126f6c2f4ac69988c0edec63b828929b22d613c19deaadc628a7e5` | `71c436bcc97d4608fee8f79e3effec34c2876dd2317975f546d36e052bc3e5ad` |
| H3 | `796dbcbea020e544652a44b10bf8c726931c89f948bcad9c4428325a83625467` | `ccf2810cc63ed6e252a324d88cd37bc7d66af22c049ff9223380edaec7ae8aee` | `a6833658f2968a2ecb3fdf9fd2d84748d3a8ef93930bdacdac37b7efec063393` |

本地详细校验结果保存为`.superpowers/sdd/2026-10-01-pg10-h-reference-ui/task-1-selfcheck.json`。两页业务JS、共享导航、common.wxss、API、关闭策略未写入；所有已有bindtap和H3分享metadata保持。

## 证据边界与交接

此记录证明源码与本地资源恢复及JS字节未漂移；不证明微信CLI编译、实际375px胶囊几何、模拟器点击、真机、原生分享送达、外部服务或正式上线。根代理独占定向CLI／模拟器验收。44px触区／32px头像加现胶囊保留空间会压缩顶部中文标题；已保持flex:1/min-width:0/ellipsis，实际设备布局需根代理核验。真实候选、长中文说明、实际依赖／新增真实图标致谢、实际版权行和真实仓库按钮造成页高与模板不同，不以虚构原文凑齐长图；没有宣称100%逐像素。

## 根代理整合后的最终快照

前文实现者自检快照保留为交接时证据；随后root定向修正原稿模糊单位及需要的text decode，详见本轮整体运行与独立补充复核。JS未改；最终源码hash如下：

| 文件 | SHA-256 |
|---|---|
| miniprogram/pages/about/about.wxml | `65b2fc974c3b66972c7d6c3bbc0f2b1aef71b9256364ab99f74523317e67c4f5` |
| miniprogram/pages/about/about.wxss | `341af349ae4d8fdaff82c7c31739f55f696d944278e2a4a9e4e7b651f07f3a67` |
| miniprogram/subpackages/profile/open-source/open-source.wxml | `7039ef63f088b956fb110d2cc07882d3f9d35f0a0be1f01de6dc10c223c5d8d4` |
| miniprogram/subpackages/profile/open-source/open-source.wxss | `39daff0a02757142ba24abadd8be41883bf7cd42f7ed68c1b6186fac61352e87` |
