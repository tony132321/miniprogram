# Wave 68 — PG10-C / PG10-D 独立只读来源审查

日期：2026-10-02。审查者 `/root/ui65_font_audit`；实施者 `/root/ui64_review`。只写本审查文档，不改产品、源证明、实施者证据、矩阵、共享字体 / 配置或 Git 状态；未运行实施者 checker、业务 VM、全量测试、SDK / CLI / 微信工具。

## 结论

发现并报告 PG10-D 两处 source spacing 偏差；唯一实施者已只修两值并更新实施证据 / freeze。对订正后的当前来源范围，**没有未解决的源码偏差**。这是独立来源与代码保护审查，不能替代根代理的实际微信渲染、字形、native inset / safe area、点击与编译包体验收，也不表示全部 39 页或线上验收完成。

## 冻结对象与读取

完整源为用户 ZIP 中 `pg10_c/code.html` / `screen.png` 和 `pg10_d/code.html` / `screen.png`；原 ZIP SHA-256 `df22e733d33fda20979b75b8a7bc94717c4a5c9e41561a54e3038432fab32603`。源 39 HTML 映射维持；两页原 HTML / PNG 的 ZIP 字节身份已在本审查者 [Wave67 四页审计](caper-next-profile-reference-gap-audit-wave67-2026-10-02.md) 核对。本轮结合完整原稿、两个完整 PNG、source token、当前两页完整 WXML / WXSS、原业务 JS / JSON 的来源与 hash、实施来源和根代理准确字体证明审查。

实施证据：[C / D reference-ui](caper-profile-moments-privacy-reference-ui-wave68-2026-10-02.md)；[sources JSON](caper-profile-moments-privacy-sources-wave68-2026-10-02.json)。来源审查及D spacing订正时冻结 `/private/tmp/caper-wave68-profile-cd/frozen-owned-paths.json` SHA-256 **403ae531748dd4abfd9c8ab34d914f1dbb319ee05b6a2801cbef3b98fd432277**；当时9个声明路径（7产品、2docs）字节 /hash一致。其后唯一C alias更新的最终freeze见下方补记。

最初审查的 freeze SHA-256 为 `330f3836effb4150975ffa75b598e9a362a14ad45b46b86f832fae00dc92d5df`。下面的来源问题发生在该初始版本；最终采用已订正版本。

## 唯一整改：D 纵向 gap

| 项目 | 完整原稿证据 | 初版产品 | 最终产品 |
| --- | --- | --- | --- |
| hero → 名单标题 | `pg10_d/code.html:11` 父层 `gap-space-lg`；同源 config `space-lg="1rem"` =16px | `.privacy-page .block-section-heading` margin-top24px | **16px** |
| 最后记录 / 空态 → help | 同父层gap16；`code.html:123` aside `mt-space-md`，同源config `.75rem`=12px；合计28px | `.privacy-page .help-card` margin-top36px | **28px** |

不存在需要猜的间距：初版把 source `space-lg` 误作24px（实际24是 `space-xl`），因此两处都多8px，实施文档也重复该错误。已先向 root 和唯一实施者报告来源 / 产品位置，审查者没有改产品。

订正后的 D WXSS仍 **12,921 B**，SHA-256 **d524bbc31f686397e95d39435e808b987975f19bb99f9bb28756fff8f25b670c**。只把上述16→24和28→36逆回时，其整文件SHA恰为初版 **19c4e7bb5d8d28970be10bc22ec0c2a06af39fa3126170bba82f76b3f04cf0b0**；证明仅两必要值改变。C 与其余产品hash未改变。这里只复核这两来源修正和新版freeze身份，没有重复既有 checker / 业务测试。

## C — 来源与样式核对

- 使用原 **Edit Profile** 标题，Jakarta body15/21、headline17/22/600、label13/16 /11/14；所有新增源scope限定 `.moments-page`，旧ownedCSS固定px转换，未改 common/global。
- 源header56px、44px返回/更多、32pxperson、17/22title、侧16 /gap8、原rgba .85 /blur24 /0_1_8 shadow；原status与native胶囊位置、menu anchor仍用既有真实字段。没有新增 status mock 或另创 XP 页。
- filters沿用真实 `all / participated / hosted` 与ID守卫；sourceblue `#1d64f2` /container `#efedf3` /variant `#424655`、源13/16以及glyph16正确。第四胶片合影仍view闭态。
- summary源三色to-right、96px lime20% /blur24 /right−16 /bottom−24、40pxicon /22glyph、source副文案13/18与badge11/14恢复；示例LIVE /12 /128 /356没有当作事实抄入。两条诚实闭态说明 /R1仍可自然增加高度。
- card源shadow-sm /radius12 /padding12 /列间距 /17/22title与13/18 date-meta恢复；源4px圆点与blue场地 **500** 以真实日期 /场地表达式渲染。statusLabel移为明确真实额外第三行，未删状态或换演示日程。
- 原拼图布局：badminton grid12/跨8及4、large4:5 /stack方图；picnic三列、各3:4；boardgame两列4:3。最终scoped规则确实覆盖旧flex /padding-top测量方式；没有把不同活动都改为单一比例。沿用原8 JPEG（实施基线544,960B）及aspectFill /绝对图片锚点，来源仍是设计示意，非真人活动相册。
- photo sourcecaption top10/left10 /dark70% /blur12 /label11/14；源sticker与picnic /boardgame各自位置 /旋转 /background /shadow恢复，caption内容继续标示示意 /未开放，不渲染假的胜者或数量 /点赞。原 source like /fake avatar /uploadSheet 没有混入真实功能。
- AI卡原violet→white→blue、p12/r12、40pxicon /22glyph、17/22标题与13/18说明正确。注意旧 `privacy-banner>view:nth-child(2)` 可能作用于新闭态pill；最终更具体的 `.privacy-banner>.privacy-unavailable{flex:none...}` 与 `.privacy-copy` 已明确覆盖，没有把pill变为扩张主文本。
- 固定源渐隐外层、max448、52pxblue CTA、20pxglyph、15/20label、11/14limebadge和native safe inset恢复。点击仍 `goCreate`发起真实活动，照片上传 /人脸识别未开放；fixedbar有pointer-events透传，唯一内容容器可点击。

## D — 来源与样式核对

- 原英文 **Privacy & Safety** 通过 `<text decode="true">Privacy &amp; Safety</text>` 表达，未把原A /B /C标题一起重命名。header源56 /44 /32 /24blur、on-surface色和native状态 /胶囊沿用。
- hero 原custom两层shadow、radius12 /p16、144pxblue5% /blur40、40pxicon22、17/22与11/14、三条body13 /21.125relaxed和6px点 /8gap对应原稿；诚实R1文案取代广场 /私信全面屏蔽承诺。
- 已订正父gap16 /help28；heading→首条8、相邻记录8、cardp12、avatar48、badge16 /glyph10、标题15/20 /chip11/14 /meta13/18、解除最小38均与来源结构对应。flat卡的gap12实现原avatar→正文的md12以及正文→操作的outer8 + pl4，不误把这两独立父层只当一个8px值。
- count继续READY真 `blocks.length`加人单位；没有演示2人 /演示姓名 /日期 /原因。登录 /加载 /失败 /重试 /READY空态 /撤销pending保持，未将原“左滑”示例说成已实现。
- empty64px圆 /32glyph、sourceheadline17/22与body13/18、help32px粉圆 /18glyph /source链接与实际 `goReport`保持。footer仍诚实R1额外说明，没有 fake客服承诺。

## 字体 / SVG 来源边界

参考根代理 [shared-font证据](caper-profile-shared-fonts-wave68-2026-10-02.md)、[source manifest](../design-sources/profile-reference-fonts/source.json)、[inspection数组 index1](../design-sources/profile-reference-fonts/inspection.json)。原headerback是明确 `text-[24px] font-semibold`；source后置face有FILL /wght可变轴，正确600 /FILL0、implicit opsz24 /GRAD0、glyphU+E2EA。两页新back均266B / `efeb362fc20c3e3a66fb6dc7be585f6ea7db8e9983609c44e148ef76807c3b24`，与根官方实例proof对应，fill `#1a1b1f`，24px控件、无path舍入；旧400 /manifest保留追溯。

D新report使用源 `#ff2d55`。独立直接比较原 /新SVG：将新root fill逆为原fill后，整个文件原字节相同；child /path、viewBox、glyph形状没有改变。最终395B / `a52c25b4c5cfb0d79e541f23d327d5b3f40a3a16af727ef7145523ab2276cdf2`。其真实 `report_problem`glyph沿用既有 [官方来源证明目录](../design-sources/material-symbols-report-problem/README.md)，未画新的警告图形。

Jakarta500由root使用 **Caper Jakarta Profile 500** 独立alias接入，避免改变N1等旧页面的原faces匹配；A owner仅给最终 `.bio-heading text` 添加alias，C原source500场地 `.moments-page .moment-venue` 的定点consumer已由C owner按root协调执行。本审查没有修改 /测试loader或从400替称500。源码family /weight可追溯不等于微信端字形已验收；实际字体、SVG显示与跨视口属于root运行验证范围。

## 业务保护与验证边界

C JS8,564B / `8b067cadb3bd9b127fd700712f138fe4ab26d4e832dc469e1817663bf4deacdb`；D JS4,209B / `f2da6b103cea1f88f6a9654a55708b94a0965cc9fefbf154064173f0afee37f2`，与之前本审查者Wave67原始观察一致；JSON源快照也保持。没有新增写入或改身份隔离。

C真实 `GET /me/events`、app.ready /session /generation守卫、onShow清除旧数据、filter验证、visible真实ID校验与canonical `/pages/event/event?id=`保留；summary和照片按钮仍使用同个实际itemID，guidelines /privacy /profile /index /create为原真实目标。D真实 `GET /me/blocks` / `POST /me/blocks/<encoded id>/revoke`、generation /actor /revokingId /实际重载 /身份变化保护，以及reportSection /support /legal路由保留。

实施者的binding multiset /WXML逆还原 /旧图源完整性结果是可读自检证据；本独立审查没有运行其`check_source.py`或把旧PASS重跑一遍。审查仅完成来源读取、必要字节 /glyph /修正核对及当前freeze身份。没有发起API读写、SDK动作或UI渲染，也没有用前端展示态宣称业务成功。根代理仍需完成本批限定的 native渲染 /点击 /真实同ID目标 /包体测量。

### 字体 alias 协调补记

本报告来源结论和D的16 /28px修正保持。root在C /D初次freeze后发现全局500face跨页匹配风险，授权独立alias与两页原source500 selector。C owner已仅给 `.moments-page .moment-venue` 新增 `font-family:"Caper Jakarta Profile 500","Plus Jakarta Sans",sans-serif;`，weight500 /color保持。CSS当前21,993B /`ecebfccf94fa19f71b600d591efb88fa883f3866665f0d3f95bfc613362b0b01`；逆除唯一新增72B片段（包含原末项后新增的分号）整字节SHA回到已审21,921B /`235566361ef68067ee22c90d81f2c70c1e5d4138f36532309b71402620e24e4d`。最终owner freeze SHA `618dc5577237c27d0f57914dc7586530f402d9e212e1ca8ecf63c2ac5c8dff7e`。这里只做此新增片段的逆回核对；第一次仅去family声明遗留新增分号，长度多1B，改为逆去准确72B新增片段后才匹配，未为核对改产品。root统一核新fontrecord与准确500文件；此补记没有运行C checker或修改C产品，也没有将已通过路线重新当作新字体运行验收。
