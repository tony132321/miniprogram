# Wave 68 五页原稿与限定微信验证

## 已实施范围

三代理并行恢复 PG10-A 资料、PG10-B 勋章、PG10-C 活动记录、PG10-D 隐私安全与 PG04-S 羽毛球发布结果页；根代理负责共享字体、CLI／SDK、矩阵与 Git。五页 JS／JSON、app／loader／21 路由配置原字节保持，既有活动分包、真实 API 和业务资格继续复用。

- A／B：[来源实施](caper-profile-edit-badges-reference-ui-wave68-2026-10-02.md)、[独立审查](caper-profile-badges-independent-review-wave68-2026-10-02.md)。原稿英文标题、原 px、光层、勋章详情双状态与按钮恢复；真实活动昵称、城市及活动记录仍接既有动作。全局资料／勋章授予／佩戴保持明确未开放。
- C／D：[来源实施](caper-profile-moments-privacy-reference-ui-wave68-2026-10-02.md)、[独立审查](caper-moments-privacy-independent-review-wave68-2026-10-02.md)。8 张原 JPEG 字节保持，实际本人活动和示意拼贴区分；D 源 spacing 经独立 review 定点修为 16／28 px，未重跑完整 checker。
- PG04-S：[限定来源及保护](caper-pg04s-implementation-wave68-2026-10-02.md)。仅 READY／PUBLISHED／badminton，旧 WXML 逆除与 CSS 前缀、全部其余分区保持。原 PNG 描边成功 mark 与 HTML inline FILL1 不同；按用户要求以提供 PNG 外观为准，新增同官方字体400/FILL0准确 glyph，保留 FILL1 历史来源，唯一 src 逆除恢复初版。
- [共享字体与图形](caper-profile-shared-fonts-wave68-2026-10-02.md)、[独立审查](caper-profile-fonts-independent-review-wave68-2026-10-02.md)：官方 Jakarta500 WOFF 29,728 B；新增 record 使用专用 `Caper Jakarta Profile 500` family，仅 A 的 `.bio-heading text` 和 C 的 `.moment-venue` 引用，避免改变其他原稿仅400／600／700／800的最近匹配。旧6faces和三份完整许可原字节，官方500数据不变。四个返回 SVG 按源24px／wght600／FILL0／#1a1b1f直接导出。共新增22个 SVG，14,669 B，包含保留的 FILL1 历史资源；没有新图标库。

各 owner 只做一次必要 source／binding／资源／保护检查；后续只验证具体修正的声明或 glyph，并更新 freeze，未重复旧101、185／55、全部FontTools或业务套件。

## 实际微信验证

[完整测量与所有失败分段](caper-wave68-devtools-measurements-2026-10-02.json)记录11个有界SDK分段：45条成功断言（包括失败分段的已成功项及重复资格 guard，不等于45个不同功能）、3条失败断言记录、6个失败分段、运行 exception 0。失败记录包括检查器px字符串／数字冲突、wx selector对内联text／image返回null、首次C读取缺events字段、SDK返回原实体 `&amp;`、结果恢复后ID selector未找到按钮，以及剪贴板预期误认为纯token。C增加路由／实际数组就绪等待后通过，旧Page／重新编译时机只是推断，没有首次route快照；copy改用本scope唯一class并等待READY／DOM后通过，没有原时序或重复ID选择证明，不判作产品缺陷。保留原结果，分别修读取／等待／预期，只补未完成动作，不修改产品来迁就检查器。

| 本批实际操作 | 结果与限制 |
| --- | --- |
| A 昵称入口／城市 | 读取本人真实已确认活动；选择同ID活动经过旧canonical redirect进入真实registrationSection；城市按钮进入现有城市页。未保存昵称／全局资料。 |
| B 筛选／说明／关闭／活动 | 运动分类只显示该类概念；详情明确未授予且佩戴disabled；关闭返回墙，活动按钮进入本人实际记录并含同ID。未发送原生分享。 |
| C 分类／拼贴／固定CTA | actual GET包含当前已确认报名；参与筛选只含CONFIRMED，主办筛选按真实owner；拼贴进入同活动详情；52px固定CTA进入真实发起Tab。没有活动照片、上传、人脸或社交互动成功声明。 |
| D 当前列表／标题／间距／菜单／求助 | actual GET本人空屏蔽列表；原稿英文标题在截图正确显示 `Privacy & Safety`；16px间距实际测到。更多进入当前隐私说明；求助定位本人真实reportSection，未提交工单或撤销记录。 |
| PG04-S 8个按钮 | 真实合成已审核主办活动经同id资格回读进入结果页；分享进入本场邀请卡和选择层；复制回读当前实际token＋标题／说明（公开JSON只记相等布尔）；海报实际canvas导出，随后未经mock的event／safety校验通过；管理格与主CTA进同id工作台；次CTA／关闭回同id详情；个人图标进同id报名成员区。 |
| 最终字体／图标 | dedicated500真实callback loaded，A／C实际可见consumer family／weight500读取通过，其他Jakarta500未新增；PG04-S 36px描边asset引用及最后截图通过。 |

PG04-S按钮之间仅恢复前端结果视图，每次先等当前实际host事件READY并核同ID／RECRUITING／审核资格；这些 `setData` 不写API，也不是一次发布。没有新活动发布或报名。本批PENDING仅来源及原JS保护审查，无新的真实PENDING fixture运行证明。

海报只mock最后 `previewImage` 原生窗口桥以捕获真实导出的临时PNG；canvas导出和资格校验未mock，finally恢复。没有原生预览、图片保存、朋友圈或消息投递验收。

10张SDK截图均已查看，其中最后资料／场地字重／成功mark复拍只覆盖对应具体修正；模拟器window402×874、status54，原稿PNG不同尺寸和动态真实文字没有整屏逐像素等同结论。中文及表情仍由系统字体回退。

## 最终编译与版本边界

CLI 2.02.2609231 RC；实际 clone `/private/tmp/irl-pg05s-final-20261001`，IDE21467／SDK9536／基础库3.17.2／本地API3037。源与clone496文件SHA逐项相同，排除明确的clone API配置和`.DS_Store`；repo基础库／API配置保持，不关闭包体检查。

| 最终 preview | 字节 |
| --- | ---: |
| TOTAL | 3,332,680 |
| main | 1,948,471 |
| activity | 428,901 |
| profile | 955,308 |
| 主包距离2 MiB | 148,681 |

Mac computer use `getApp` 返回锁屏，既有解锁问题待答；本批没有新增原生实点。未跑全量本地、全量业务或CI；正式AppID、HTTPS／订阅模板、真机、真人运营及三场受控活动未验，不能据此声称项目／39屏／外部发布全部完成。下一批消息与主办／签到／AA原稿仅完成来源准备，实施另验。

## 提交门禁

当前批次91个staged changed路径已检查：72文本／19二进制，凭证模式发现0，cached whitespace check退出0；原未追踪开发包未stage。随后增加本段与脱敏metadata-only [门禁记录](caper-wave68-staging-proof-2026-10-02.json)，最终index另核。此检查限当前改动，不是全仓／业务测试。
