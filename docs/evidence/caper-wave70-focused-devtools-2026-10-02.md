# Wave 70 六屏原稿恢复与限定微信验证

日期：2026-10-02。复用已提交 Wave69 `147ce97` / `b45a99d`；三子智能体与 root 并行独占实现与独审。不运行全量测试或 CI，提交使用 `[skip ci]`。微信测试 AppID、本地 API3037与真实服务端合成身份；正式外部资源仍待验。

## 本批范围

- 首页 `pg02_b/c/d`：40准确SVG、2张与原稿同URL/字节的JPEG；只在实际待审/重确认/候补、已审核主办与已完成历史状态生效，完整业务JS/JSON保护。独审发现字距、pill字重/颜色、历史滤镜、capsule及最后3个常量后只修对应delta，不重复93 /62 /40项来源保护。原稿未存在的聊天、相册、评分、自动支付和摄影/骑行业务不伪造。
- PG07：6准确SVG、实际批准question/answer父子关系、匿名昵称与真实composer。独审补源pulse/ping、placeholder、pressed/focus及最后chip `.275px`；JS无业务改动。输入未提交，question/answer没有新写入。
- `_2` 已确认成员 / `_4` 当前主办详情：18资产（15准确SVG、2原hero和1原地图）；原图同字节移入activity分包。真实版本、规则、场地声明、费用/人数/昵称与当前身份保留。独审最后只修 host roster独立白grid、status/title角色、map inset/footer8与真实capacity800/600/11三个槽。原map明确是示意、导航/永久pass/群聊关闭。
- 主包真实CLI超限触发6资源无损移入活动分包：4原JPEG图片及2二维码模块，合计287,744原始B。二维码算法、canvas、identity/version/expiry/hide逻辑原byte保留；22既有测试仅路径适配，另1行程expected图片字面路径。

实施／独审：[首页实施](caper-home-states-reference-ui-wave70-2026-10-02.md)、[首页独审](caper-home-states-independent-review-wave70-2026-10-02.md)、[PG07实施](caper-pg07-reference-ui-wave70-2026-10-02.md)、[PG07独审](caper-pg07-independent-review-wave70-2026-10-02.md)、[详情实施](caper-member-host-detail-reference-ui-wave70-2026-10-02.md)、[详情独审](caper-member-host-detail-independent-review-wave70-2026-10-02.md)、[资源迁移](caper-resource-subpackage-migration-wave70-2026-10-02.md)。合计61新准确SVG；没有新增程序字体，原full font仅docs来源。

## 限定运行

[实际测量](caper-wave70-focused-devtools-measurements-2026-10-02.json)：12成功分段 / 8保留失败分段，81成功局部SDK断言、1失败断言，runtime exception 0。这是受影响状态/按钮的局部证据，不能当全项目通过率。

| 分段 | 实际结果与范围 |
| --- | --- |
| 首页三状态 | 27：REQUESTED/RECONFIRM_REQUIRED/WAITLISTED真实卡和同ID报名/规则/退出入口；APPROVED招募2确认/1待审/差2与IN_PROGRESS host；COMPLETED成员反馈和主办再约目标。仅导航/输入，不退出、发公告、交反馈或创建草稿 |
| 首页 reviewed delta | 7：只看独审修正颜色/字距/字重/filter/no-dot/pressed class，不重跑旧路线；5张reviewed安全图 |
| 二维码 runtime | 3：迁移后真正wx canvas导出与getImageInfo为160×160；像素/口令/临时导出都未进入公开证据 |
| PG07及delta | 9 +2：真实批准问答父子节点、header64/avatars40/24/send44、host回答输入定位/member composer；SDK animation shorthand返回null且tap focus0，原生动画/focus绘制尚未验 |
| 详情成员 / 主办 | 10 +8：真实CONFIRMED 6人与当前host，header56/hero224、原hero、pass进入同场签到且无host生成器，成员/内容/费用/host路由；地点复制桥用mock捕获并cleanup，非原生系统剪贴板实点 |
| 移动图片 | 7：实际授权WAITLISTED旧访客UI、现有host published projection、真实行程分别读新src；3原资源wx.getImageInfo尺寸非0。没有新发布 |
| 最终常量 | 3：只看反馈sticker shadow-sm与PG07 `.275px`；首页CONFIRMED pill和COMPLETED主办AA标签缺当前合成精确组合，仅独审source/inverse，不setData伪造或再造业务 |
| 主办独审4类delta | 5：只核transparent heading/actual white empty frame/caption、status/title颜色、map inset/footer8、capacity分槽；2张最终reviewed图。旧8路由不重跑 |

仅三个指定二维码/分享/海报模块文件40/40，exit0，覆盖实际矩阵与账号/版本/隐藏/期限保护；其余19个QR路径适配文件与行程全文件未跑。纯样式不添加镜像测试。

### 保留的失败与修正

8个SDK失败分段均在测量保留，7个在首个有效断言前失败，另最后host颜色分段1成功后1失败：PG07 reLaunch立即读取旧首页，后来加route guard；animation style null被脚本当string，改为记录SDK不可观察边界；详情第一次sync错误使用manifest不存在key，后来按detailProductPaths修正；详情第二次旧SDK上下文route timeout，最终CLI及freshauto后成功；图片第一次无邀请码新访客无法读取邀请制活动，改用已有真实授权WAITLISTED身份，不放开权限、不新增邀请；host最后样式脚本两次误要求非空昵称grid，实际aliasLoadState READY且空名单，改读真实白色empty frame，source非空grid仅独审不造昵称。host静态source已通过，但运行发现主行颜色伪类未生效，owner仅加明确class和selector，最后只补该项及未执行map/footer/capacity，已过roster不重跑。失败不能抹去或当成通过。

仅新增1条必要本地WAITLISTED报名夹具：POST201 / 真实status WAITLISTED，经GET/me/events回读；原有REQUESTED和RECONFIRM/COMPLETED/问答等夹具复用。SDK实际工作没有新报名/审批/发布/反馈/AA写入，复制/二维码只在临时桥与canvas验证。

## 编译、快照与边界

两次CLI process exit0却返回code10 /main2059及2050 KB超2048 KB，门禁均记失败。原字节资源分包后门禁通过；最后仅四host source delta触及模板，做最终编译门禁：TOTAL 4,058,861 B / main 1,939,748 B（余 157,404 B），activity 1,163,805 B / profile 955,308 B。不把原始搬移字节等同CLI节省数。冻结git index与实际clone完整mini源码一致性由[提交证明](caper-wave70-final-source-staging-proof-2026-10-02.json)记录，config.js / .DS_Store排除。

18张公开截图已实际查看，初stage和reviewed版本分开，不用最新source覆盖旧图证据口径。Mac两次CUA读取仍报告locked，本批没有原生前台按钮、微信投递、真机或生产结论。

N2/`_5`独立布局及PG06-S只读背景在[下一批计划](../superpowers/plans/2026-10-02-compact-center-live-monitor-and-share-background.md)接续；其并发71产品明确排除于本次commit/clone。普通首页/发现/我的/消息整长页及39屏逐像素仍逐项继续，正式AppID、HTTPS合法域名、订阅消息、真机与真人三场活动未取得资源。

## 已查看截图

- [caper-announcement-member-composer-wave70-2026-10-02.png](images/caper-announcement-member-composer-wave70-2026-10-02.png)
- [caper-announcement-timeline-wave70-2026-10-02.png](images/caper-announcement-timeline-wave70-2026-10-02.png)
- [caper-details-confirmed-member-wave70-2026-10-02.png](images/caper-details-confirmed-member-wave70-2026-10-02.png)
- [caper-details-current-host-wave70-2026-10-02.png](images/caper-details-current-host-wave70-2026-10-02.png)
- [caper-details-host-roster-reviewed-wave70-2026-10-02.png](images/caper-details-host-roster-reviewed-wave70-2026-10-02.png)
- [caper-details-host-source-reviewed-wave70-2026-10-02.png](images/caper-details-host-source-reviewed-wave70-2026-10-02.png)
- [caper-home-history-host-reviewed-wave70-2026-10-02.png](images/caper-home-history-host-reviewed-wave70-2026-10-02.png)
- [caper-home-history-host-wave70-2026-10-02.png](images/caper-home-history-host-wave70-2026-10-02.png)
- [caper-home-history-member-reviewed-wave70-2026-10-02.png](images/caper-home-history-member-reviewed-wave70-2026-10-02.png)
- [caper-home-history-member-wave70-2026-10-02.png](images/caper-home-history-member-wave70-2026-10-02.png)
- [caper-home-organized-in-progress-wave70-2026-10-02.png](images/caper-home-organized-in-progress-wave70-2026-10-02.png)
- [caper-home-organized-recruiting-reviewed-wave70-2026-10-02.png](images/caper-home-organized-recruiting-reviewed-wave70-2026-10-02.png)
- [caper-home-organized-recruiting-wave70-2026-10-02.png](images/caper-home-organized-recruiting-wave70-2026-10-02.png)
- [caper-home-pending-reconfirm-reviewed-wave70-2026-10-02.png](images/caper-home-pending-reconfirm-reviewed-wave70-2026-10-02.png)
- [caper-home-pending-reconfirm_required-wave70-2026-10-02.png](images/caper-home-pending-reconfirm_required-wave70-2026-10-02.png)
- [caper-home-pending-requested-wave70-2026-10-02.png](images/caper-home-pending-requested-wave70-2026-10-02.png)
- [caper-home-pending-waitlisted-reviewed-wave70-2026-10-02.png](images/caper-home-pending-waitlisted-reviewed-wave70-2026-10-02.png)
- [caper-home-pending-waitlisted-wave70-2026-10-02.png](images/caper-home-pending-waitlisted-wave70-2026-10-02.png)
