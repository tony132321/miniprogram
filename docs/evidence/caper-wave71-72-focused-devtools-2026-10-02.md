# Wave 71 / 72 限定微信验证（2026-10-02）

## 范围和原稿

三子智能体并行实现 N2 紧凑通知中心、当前主办只读 `_5` 看板、PG06-S 弹层背后原 PG06 只读背景；随后恢复 `caper_1` 普通个人长页。复用原通知、审批、人数、已确认名单、身份与版本守卫和现有路由。27 产品文件经最终冻结验证，包含 17 新资源；本批没有首页、发现和消息普通长页的后续在途改动。

[N2 独审](caper-messages-compact-center-independent-review-wave71-2026-10-02.md)、[主办看板独审](caper-host-monitor-independent-review-wave71-2026-10-02.md)、[背景独审](caper-share-background-independent-review-wave71-2026-10-02.md)、[个人长页独审](caper-profile-ordinary-long-page-independent-review-wave72-2026-10-02.md)逐项核对原 HTML/CSS、准确 glyph 与旧绑定。纯视觉不加照搬实现的测试；两个新菜单/权限行为仅执行新增的 N2 7 项、看板 6 项有意义的红绿测试。

## 定向运行

[原始分段和测量](caper-wave71-72-focused-devtools-measurements-2026-10-02.json)保留 58 个成功 SDK 断言（W71 32 / W72 26）、2 个失败辅助/错误预期断言及零检查失败分段；重复保存的失败副本不重复计数。成功断言包含 geometry 与异常守卫，不能称为 58 个业务场景。记录的异常均 0，业务写入 0。

- N2：原更多菜单选 COMPACT，实际通知/审批、筛选、分页投影保留；返回 CARDS 和原设置焦点通过。原审批详情实际进入同 ID `hostSection`，测试最初错误期望 registration，已只补验该剩余路由；通知设置实际定位核心区，不强制打开高级表单。
- `_5`：当前合格主办原更多菜单进入只读看板，实数 6 确认/1 候补及实际成局条件；已确认名单 6 条、未知天气/自动提醒/订场/付款/导航均明确不可用；同 ID 主办返回、授权深链和普通成员拒绝通过。
- PG06-S：原普通 `_3` 无额外背景；打开后只读投影四个真实统计，56px 顶栏、16:9 hero 和层级通过；背景不暴露实际邀请码/精确场地、不造人物；关闭回原活动，未重跑旧海报/复制业务。
- `caper_1`：当前可用 18 个长页入口中，16 个现有路由、1 个按当前活动资格的邀请与 1 个既有隐私表单展开均通过限定实点；退出只在原会话守卫条件下显示，本开发身份未显示，因此未验退出。旧安全表单开始折叠，移到原危险区的请求入口展开既有手工/导出控件，没有提交请求、删除、退出或修改通知授权。

个人长页的 SDK `nth-child` 选择器曾匹配容器，另有跨页 RPC 超时和一个 55s watchdog；保留失败分段，改为已有实际按钮集合与就绪等待后，只补剩余动作。没有据此改业务源码，也没有重复已成功动作。watchdog 分段未进入 finally，不把其清理算成功；后续分段恢复当前记录的合成身份。

7 张安全截图已经逐张看过：[N2](images/caper-compact-center-actual-approval-wave71-2026-10-02.png)、[看板](images/caper-host-monitor-actual-top-wave71-2026-10-02.png)、[地图示意](images/caper-host-monitor-illustrative-map-wave71-2026-10-02.png)、[看板诊断](images/caper-host-monitor-top-diagnostic-wave71-2026-10-02.png)、[分享背景](images/caper-share-background-sheet-wave71-2026-10-02.png)、[个人工具](images/caper-profile-long-tools-actual-wave72-2026-10-02.png)、[个人菜单](images/caper-profile-long-public-menus-wave72-2026-10-02.png)。分享图在记录前临时遮实际口令后恢复；看板地图和原照片是设计示意，不是定位证据。模拟器圆角框外灰色截屏边缘仍未定位，辅助全节点查询不完整，而单独旧详情/海报查询为 display:none 且零尺寸；没有把此现象认定为源码缺陷或原生视觉通过。

## 最终编译和边界

完整 W71/72 冻结小程序在 `/private/tmp/irl-pg05s-final-20261001` 执行一次最终 CLI preview，exit 0，无 WXML 编译错误。总包 **4,335,244 B**，主包 **2,010,442 B**（余 **86,710 B**），活动 **1,369,494 B**，个人 **955,308 B**。测试 clone 的正式项目配置和 repo 原配置分开；最终 641 文件缓存 index 与实际测试源码比对仅排除既定测试 config.js / .DS_Store，差异 0，见[冻结暂存证明](caper-wave71-72-final-source-staging-proof-2026-10-02.json)。原字节资源新增量不当作 CLI 压缩后的增长量。

Mac 当前锁屏，原生前台 computer use 与真实菜单弹窗尚无新增验收；菜单选择为 SDK callback。没有全量测试或 CI，本批提交使用 `[skip ci]`。正式 AppID、HTTPS 合法域名、订阅模板、真机/真人运营和三场受控活动仍无资源；全 39 屏逐像素和正在恢复的首页/发现/消息普通长页仍待验。此批不表示整个项目完成。
