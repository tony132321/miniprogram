# Wave 73 / 74 三普通长页与限定微信验证

## 原稿与并行范围

三个子智能体独占首页 `caper_2`、发现 `caper_4`、消息普通 INBOX `caper_3`；根独占共享照片、字体、JSON、CLI/SDK、矩阵与 Git。31 个 page-owned 产品冻结（6 WXML/WXSS + 25 准确 SVG），三页 raw 净增 **104,007 B**。旧业务 JS、通知/审批/身份守卫、首屏及既有独立状态通过 source inverse/事件契约保护。[冻结汇总](caper-three-ordinary-long-pages-frozen-source-summary-wave73-74-2026-10-02.json)与[首页独审](caper-home-ordinary-long-page-independent-review-wave73-2026-10-02.md)、[发现独审](caper-discover-ordinary-long-page-independent-review-wave74-2026-10-02.md)、[消息独审](caper-messages-inbox-ordinary-long-independent-review-wave74-2026-10-02.md)分列作者检查、具体订正与最终增量。纯样式没有照搬实现的单元测试。

根接入 **12 张准确原响应 JPEG / 806,316 B**，不重编码：11 张首页新图 / 683,581 B，另公园 / 122,735 B 在发现页两个消费者复用。profile 分包只读 `reference-image` 使用官方跨包组件/placeholder 合同、静态 whitelist、virtualHost/shared/externalClasses；未知 key 不加载 URL，失效清旧 src。原已同 byte 的3首页及7发现照片保持路径，真实本人活动仍绑定服务端摘要。

主包字体整文件搬 profile，主 loader 用 `require.async`，异步失败只记录不可用并 fallback，不阻登录。Caveat700 依次准确增原固定文本缺字，最后700的 W / 600的 y 由独立审计发现后增补；最终模块 **262,502 B** / `fb39653c8663ba1bb7aa79e90df267aca6d1c6dd606ea484d8a052dbd53ad3de`，相对原模块净增29,515 B。最后[W/y 独审](caper-reference-font-final-character-delta-independent-review-wave74-2026-10-02.md)确认56个旧字符轮廓、advance/LSB、全局metrics和6个其他face/完整许可不变。历史260,198 B阶段报告保留，不能作为最终payload。组件解析与字体异步新行为仅 **3 + 3** 定向 VM 通过；loader RED和一次callback调度快读失败保存，无旧测试或全量重跑。

## 定向 SDK 结果

[分段测量](caper-wave73-74-focused-devtools-measurements-2026-10-02.json)列 **117 成功断言、5 失败辅助/错误预期断言**；含几何、异常守卫、部分成功段，不能称117业务场景。原始 source 观察和补验关系保存，所有所列运行异常0。早期首页 modal 的原JSON被后续成功段覆盖：仅保留已知失败边界和新的 adapter diagnostic，不伪造原始JSON、不把旧失败改称通过。SDK原型组件与旧字体8回调探针单列，不重复合计。

- **首页**：11实际图像消费者加载、固定80 hot框、48构思图、176品牌、拼贴、192city原几何；15实际灵感按钮捕获原标题的现有提示并SDK取消。顶部/下部长页12个路由入口分别去发起、发现、行程、关于、公约、城市，真实member活动卡进入相同活动ID。
- **发现**：轮换真实既有推荐组，轮换后3推荐+3campaign+6weekly+2命名路线+4场景共18提示消费者各一次。原脚本误期望17的失败保留，离线只订正计数，不重跑18按钮；默认组的实际收藏catchtap明确关闭且不冒泡。六header/底部路由及附近本人/个人卡两个同ID活动入口通过；本人深圳实际活动与2个原公园component、200/112推荐、200/80个人、112拼贴、64weekly、220/112路线和80场景几何通过。
- **消息**：现有 CHAT_UNAVAILABLE、已OPENED同ID通知→同活动详情、AI主按钮→发现、设置→个人真实通知区且不开高级表单，四实际入口通过。打开已OPENED通知仍触发原幂等 `/open` 源路径；网络未拦截计数，不称零HTTP写入。返回仍同一条OPENED通知、总数1无新增。当前提醒次按钮和分页未出现，明确 conditional-not-rendered，不注入队列伪称实点。13个实际可选择节点记录44/32/40/128/40、五96×64相册设计槽、32历史图形、24×1页脚、摘要normal/visible/clip与settings title inline12/16/helper10/15。两个无class内层view/text的native tag selector不可读，settings父16/24和archive helper slate400只有独立source证据，不冒称native已测。
- **字体最后增量**：最终CLI编译后实际8全局字体回调全部 loaded；发现 `Wukang Road` 实际consumer为Caveat700且已复拍可见W。第一张安全截图被sticky栏遮字，修正仅截图viewport后补拍，不改产品或重复字体断言。PG01已有 `Play More` 的y600为准确glyph/source与全局callback证据，未重跑旧PG01路由。

harness的虚拟host/外部类、setData快读、错误source key、native tag选择器及RPC超时/watchdog均按实录保留；只补剩余动作。watchdog段未finally，不能声称该段身份已恢复；其后分段正常finally恢复。应用没有为自动化选择器改业务代码，没有发布/报名/审批/费用等新提交。

## 截图、最终源码和编译

9张安全截图已逐张看过：

- [首页品牌/热门](images/caper-home-long-brand-hot-wave73-74-2026-10-02.png)、[首页拼贴/city](images/caper-home-long-collage-city-wave73-74-2026-10-02.png)。
- [发现推荐/附近](images/caper-discover-long-recommend-nearby-wave73-74-2026-10-02.png)、[发现拼贴/weekly](images/caper-discover-long-moments-weekly-wave73-74-2026-10-02.png)、[发现场景/发起](images/caper-discover-long-scenes-create-wave73-74-2026-10-02.png)、[最初字贴截图](images/caper-discover-long-final-handwriting-wave73-74-2026-10-02.png)、[可见字贴补拍](images/caper-discover-long-final-handwriting-visible-wave73-74-2026-10-02.png)。
- [消息AI/相册](images/caper-messages-inbox-long-ai-album-wave73-74-2026-10-02.png)、[消息设置/页脚](images/caper-messages-inbox-long-settings-footer-wave73-74-2026-10-02.png)。

最终全部683小程序文件（仅排除既定测试 `config.js` / `.DS_Store`）与实际测试clone一致，见[最终暂存源码证明](caper-wave73-74-final-source-staging-proof-2026-10-02.json)。CLI preview exit0：总包 **5,282,302 B**，main **1,887,500 B / 余209,652 B**，activity **1,369,494 B**，profile **2,025,308 B / 余71,844 B**。仅最后W/y引入新delta后重编译一次最终包门，之前阶段包信息保留；CLI auto成功开启9536。

## 未完成与真实资源边界

CUA最新 `getApp('/Applications/wechatwebdevtools.app')` 明确 Mac锁屏、自动解锁失败，不能新增native前台实点。模拟器圆角框外旧灰边仍未定位；部分截图滚动位置遮标题，不据此认定source错误或逐像素通过。首页整页max440/core大屏约束未恢复，手机402范围不受该阈值影响；不宣称平板或全39屏逐像素通过。

正式AppID/HTTPS/订阅模板/真机/真人值守/三受控活动仍无资源。真实微信订阅发送与一次性模板授权是尚需正式模板契约的具体集成代码，通用同意/回执/查单已有；隐私框架/标记客户端/到期处置已有，未决用途字段需正式策略，人工审核已有但外部检测和运营待接；既有脱敏业务事件已写，正式新增曝光/点击字典与成熟试点证据待提供。UI接入不表示这些上线门完成，也不声称整项目代码/验收100%。本批不运行全量测试或CI，提交 `[skip ci]`。
