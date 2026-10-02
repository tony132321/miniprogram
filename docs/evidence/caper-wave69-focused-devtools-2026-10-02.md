# Wave 69 原稿恢复与限定微信验证

日期：2026-10-02。延续 Wave 68 `2e3e027`，三个子智能体与 root 独占文件并行实施；没有全量测试或 CI。R1 测试 AppID、本地 API、合成身份，真实外部资源仍待验。

## 交付与来源

- PG06 主办、PG08 签到与完成态反馈、PG09 AA：32 产品路径、30准确SVG，源净增80,821 B；JS／JSON及其他旧 scopes保护。FILL1 active rclt、成员字级、PG09 gutter、官方 shadow-sm 的明确源偏差均只做定点修正，没有重复142项来源检查。
- N1 CENTER和Alex关闭态：23准确SVG，原INBOX／旧CSS和全部真实绑定保护；N2无独立入口未实施。root运行发现视图继承滚动，使筛选藏在fixed header下；三个现有setData callback增加回顶，213 B净增，独立逆除恢复原JS，5项限定SDK通过。
- PG06-S前景分享弹层：8准确SVG、40,193 B准确原JPEG，原 `_3` 卡与JS／JSON保持。7处有效CSS字体级联偏差经独立复核纠正；官方新子集与原full版本不同，但八字形轮廓逐字一致。背后仍为实际 `_3` 邀请卡，与原PG06背景不同，未声称整屏逐像素。

来源与审查：

- [活动实施](caper-host-checkin-aa-reference-ui-wave69-2026-10-02.md)、[活动独审](caper-host-checkin-aa-independent-review-wave69-2026-10-02.md)
- [消息实施](caper-messages-center-chat-reference-ui-wave69-2026-10-02.md)、[消息独审](caper-messages-center-chat-independent-review-wave69-2026-10-02.md)
- [分享实施](caper-share-sheet-reference-ui-wave69-2026-10-02.md)、[分享独审](caper-share-sheet-independent-review-wave69-2026-10-02.md)

合计61个准确新增SVG；现有字体与许可复用，主包没有新增字体。准确原full font只存docs，不进入程序。

## 限定运行及保留的失败

[实际测量](caper-wave69-focused-devtools-measurements-2026-10-02.json)共9分段：7段PASS、2失败保留，49成功断言、1失败断言、runtime exception 0。它们是受影响路线的局部证据，不是整个项目或全39屏通过数。

| 分段 | 实际结果 |
| --- | --- |
| Messages | 8成功：N1源header／filter、真实通知collection、同场COMPLETED成员反馈deep link、关闭私聊禁用输入与返回；实际通知API变OPENED |
| Share首次 | 4成功后脚本在close阶段失败：复制前refresh按既有行为关闭sheet，脚本错误假定仍打开；非产品缺陷 |
| Share剩余 | 3成功：重新打开只补close／cancel及安全截图，不重复复制和几何 |
| Messages滚动修正 | 5成功：真实CENTER entry/back与chat entry/back回顶，筛选位于header底部以下；其余已过8项未重跑 |
| PG06 | 8成功：实际6确认／5+1授权成员、source几何、同ID成员区、真实公告输入定位和当前分享卡；无公告提交或取消 |
| PG08反馈 | 10成功：原null无默认答案、四radio真实true/false、未举办原因必填、下一局进入新IDEA、已反馈成员无重复form；无反馈提交 |
| PG09首次 | 2成功后立即读插入DOM的断言失败；source header／4:3 hero／44 avatar通过，保留原失败 |
| PG09剩余 | 6成功：只补实际数据与DOM就绪后的明细、5人展开、排序与成员仅本人1份额／无host控件；无费用写入 |
| PG08 live | 3成功：实际IN_PROGRESS／host／时间窗资格、当前短期动态码、真实240 canvas／272容器；只生成本地短期码，无成员签到 |

反馈前后API逐字段相同（member-1未提交／member-3已提交），没有新发布、报名、取消、公告、反馈、AA双方标记或真实聊天。公开截图的sheet口令临时在视图中遮挡并恢复；live截图在生成动态码前拍，不含码。第一次sheet失败截图含有效合成邀请码QR，仅保存在private tmp、从Git产物排除，不计为公开证据。

## 编译、完整源码和边界

最终微信CLI preview退出0：TOTAL3,515,720 B／main1,993,189 B（2MiB余103,963 B）／activity567,223 B／profile955,308 B。初gate后出现具体shadow／回顶修正，因此仅做一次最终包体gate；没有扩大业务测试。最终repo与实际测试clone558个文件同SHA（排除config.js／.DS_Store）；数字由实际测量记录为准。

13张公开模拟器截图已逐张实际查看，含初次CENTER继承scroll失败外观及修正后首屏，不将旧图隐藏为通过。Mac电脑操作最新明确报locked，因此没有本批原生前台按钮／微信投递／相册保存／真机／生产结论。永久凭证、支付、离线码、假头像／群聊和AI功能没有伪装为R1数据。

后批 [首页／PG07只读审计](caper-next-home-members-reference-gap-audit-wave69-2026-10-02.md)、[详情只读审计](caper-next-detail-roster-reference-gap-audit-wave69-2026-10-02.md)和[Wave70计划](../superpowers/plans/2026-10-02-home-states-members-and-details-reference-ui.md)仅为下一批输入。该批产品在Wave69 immutable snapshot之后才启动。

## 已查看截图

- [caper-aa-host-expanded-wave69-2026-10-02.png](images/caper-aa-host-expanded-wave69-2026-10-02.png)
- [caper-aa-host-wave69-2026-10-02.png](images/caper-aa-host-wave69-2026-10-02.png)
- [caper-aa-member-own-wave69-2026-10-02.png](images/caper-aa-member-own-wave69-2026-10-02.png)
- [caper-checkin-live-host-wave69-2026-10-02.png](images/caper-checkin-live-host-wave69-2026-10-02.png)
- [caper-feedback-recorded-wave69-2026-10-02.png](images/caper-feedback-recorded-wave69-2026-10-02.png)
- [caper-feedback-selected-no-wave69-2026-10-02.png](images/caper-feedback-selected-no-wave69-2026-10-02.png)
- [caper-feedback-unselected-wave69-2026-10-02.png](images/caper-feedback-unselected-wave69-2026-10-02.png)
- [caper-host-dashboard-wave69-2026-10-02.png](images/caper-host-dashboard-wave69-2026-10-02.png)
- [caper-notifications-center-top-wave69-2026-10-02.png](images/caper-notifications-center-top-wave69-2026-10-02.png)
- [caper-notifications-center-wave69-2026-10-02.png](images/caper-notifications-center-wave69-2026-10-02.png)
- [caper-private-chat-closed-top-wave69-2026-10-02.png](images/caper-private-chat-closed-top-wave69-2026-10-02.png)
- [caper-private-chat-closed-wave69-2026-10-02.png](images/caper-private-chat-closed-wave69-2026-10-02.png)
- [caper-share-sheet-wave69-2026-10-02.png](images/caper-share-sheet-wave69-2026-10-02.png)
