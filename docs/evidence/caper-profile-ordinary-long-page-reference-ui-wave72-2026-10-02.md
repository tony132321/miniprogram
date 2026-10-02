# Wave 72 — caper_1 普通“我的”长页来源恢复

## 范围与初始冻结

仅编辑 `miniprogram/pages/me/me.wxml`、`me.wxss`；新来源目录 `docs/design-sources/caper-profile-long-page-wave72/` 为 docs-only。业务 JS / JSON、核心首屏、授权开关及回读文案、完整展开安全表单、五 Tab / 全局字体 / 配置未修改。Wave 71 分享背景保持上一冻结字节；根代理按批次决定同步与提交。

| 产品 | Bytes | SHA-256 | 本批净增 |
| --- | ---: | --- | ---: |
| me.wxml | 24,288 | `6854799062489ef6bf70e0ae29f0f9ca2cbf0e38ff98b7b50071df5438fed949` | 3,171 |
| me.wxss | 32,844 | `1c5f6c235b4b36f58b1690e7d4b319cf855d1faae08620faf546b9f657601196` | 10,713 |
| me.js（保护） | 53,362 | `def9a36a9c46deca17cebbe95e5bd8672469eea6e759fd279b45d28c9f87021b` | 0 |
| me.json（保护） | 63 | `1bc6ec418e7c2ba28f9ec3a5479da2a73c9d8eb8066588dbcd128604a39a9880` | 0 |

产品新增 **13,884 B**；新 runtime SVG / 图片 / 字体 **0 B**。复用已有蓝/灰准确 chevron，继续使用旧 hostedPreview illustration cover；不是新下载照片。

## 原稿

完整阅读用户 ZIP 中 caper_1 HTML 与长页 PNG，已实际查看 PNG；原文件与 ZIP 对应 entry 逐字节相同：

- ZIP：24,668,856 B，`df22e733d33fda20979b75b8a7bc94717c4a5c9e41561a54e3038432fab32603`。
- HTML：42,473 B，`37088f60630a26b0c2711c9ef018076d3ede9128cf33e5b7bf399fb66217faf9`。
- PNG：`8901eb5958e4ecb9a209d40992c0214e5e6b1d89b99a64b5eabea22df6bbb369`。
- 原长页节点见 HTML 438–751 行；源码副本 `caper_1-code.html` 保留原字节，PNG 只记录原来源/hash，不把大图放入程序。

## 恢复的源布局

所有新规则限定 `.me-long-*`，只有长页两个 wrapper；全旧 CSS 是最终 CSS 的精确 byte prefix。没有修改公共 `.card` / `.section-head` 规则，没有把字体继承包到 advanced 区域。旧首屏 native status/capsule/100% window / Tab / safe spacing 继续由既有实现负责。

- 原长页 section 间距 20 px；标题 14/20 px / 900、蓝色 6×14 marker、12/16 px 查看链接、14 px 蓝色源 chevron。
- 主办卡 12 px padding / 12 px gap / 16 px radius / `shadow-soft` / slate100 border；80×80 px 图 / 12 px radius。真实标题 12/16 / 700；状态牌原 10/15 / 700 / p2×6 / r4；时间 10/15，场馆 10/15；真实说明使用原 9 px 次级 role。
- 工具 4 列 / gap8；卡 py12 / r16 / source soft shadow；circle36 / source blue50 / emoji18/28，原 ➕ 📅 👥 📊；真实三个动作保留，数据看板仍关闭。关闭说明 10/15 是实际 R1 文案的必要扩展，未制造第四个可点击动作。
- 账号/通知/帮助/关于 card p14 / r16 / source soft shadow；内标题 12/16 / 900，marker4×12；账号 rows gap10 / py2，其它 gap8；帮助/关于 rows py4。12 px 本文、14 px 标题灰 chevron / 12 px 行灰 chevron。原手机号/设备等假字段未接入，原三 checked push switch 未创建。
- 邀请卡 p16 / r24，原 blue500→indigo600 水平渐变 / float shadow，128 px 白10% orb / blur24 / right-24 / bottom-32；标题14/20 / 900 / tracking-.35，真实说明11/13.75 / 500；按钮 p6×14 / 原 lime / rfull / 12/16 / 900 / shadow-sm / active.95。
- Danger 区 mt24、标题11/16.5 / 700 / tracking.55；退出按钮 py12 / r16 / rose200 border / 12/16 / 700 / source soft shadow / active.99。人工请求面板 p12 / r16 / rose50 60% / rose100，既有单一入口使用源 12/16 / 700，真实解释10/15 / rose400。
- 原 slogan 尺寸：py24 /10/15 /700 / slate300 / tracking.5；原现有 `REAL PEOPLE · REAL MEETUPS` 文字保留。

旧 `.invite-banner > view text` 规则会直接设 text 字号/色/上距，所以新 title 的每个 text 明确重置 source inheritance / margin0；真实 description 同样 margin0。此项已由有效 CSS 观察确认，不仅检查声明字符串。

## 真实数据与动作

`me.js:419–421` 对 `/me/events` 行保留原 spread 并计算状态/时间/示意 cover；461 行选第一个 `isHost`。`src/server.ts:403–441` 的 authorized projection 确有 city / venueName，且未获审核的信息按原服务端逻辑省略。因此新地点只在实际字段存在时显示，未加入 sample 上海/静安、成员头像、+8 或实际报名数。

原主办图为 `activityCover` 的场景示意，界面明确“场景示意图”；没有宣称它是现场照或原 caper_1 专用照片。原 participants mock role 改为真实“进入真实活动详情”提示。只有实际 IN_PROGRESS 牌使用源 emerald paint，其它真实 statusLabel 保留、使用源 slate 中性 palette，未把招募/结束/取消伪装为“进行中”。

本批仍有 19 个长页 action 节点，真实目的地保持：邀请码→现有发现邀请入口；查看主办 / 活动管理→真实 hosted moments；主办卡→原 canonical event ID；主理人中心→organized 首页；发布→真实 create；报名管理→真实消息 approvals；资料/屏蔽/通知/记录/求助/缓存/关于/法律/公约→已有实际页面；邀请→现有 one/many/none eligibility 逻辑；退出→真实 logout。

原账号第三项 **showPrivacyRequests** 仅搬到源 Danger 面板：保留同一 action，复制完全相同的 `(hasSession || developmentMode) && loadState !== 'ACCESS_DENIED' && loadState !== 'UNAUTHENTICATED'` 祖先守卫。它只展开已有 privacySection；真正 EXPORT / DELETE 等动作与提示继续处于旧 advanced 字节中。新面板明确“进入人工核查请求表单；提交申请不会立即删除账号或共享记录”，没有实现立即注销。退出保持 hasSession 与 !developmentMode 原条件；未登录不显示原本人数据入口。

收藏保留“待开放”和现有邀请码 action，未复制源音乐/徒步收藏图片、32/18 人想去或假 heart 行为；账号卡只保留真实资料/屏蔽，通知卡是两项真实入口/实际通知回读；帮助是两个已有 endpoint；关于三项实际路线，不复制假 v1.2.0。为保留真实说明，部分原一行 mock field 是两行内容；这些是明确 R1 数据边界，不能据此宣称全部 mock 图形/字段逐像素等价。

## 一次限定检查及证据

`targeted-source-protection-proof.json`：最终 **26 项**通过，含 **63 个全页真实 action 节点 / 49 个 handler** 的属性与有效 wx 祖先守卫 multiset 精确一致（只是一个入口换源槽），没有新/丢 action；handler 均存在于 unchanged JS。

- 原核心及法律同意 prefix：8,667 B / `6ae94e81234c603fe2e13604751e356e5f614f19d18a5c27a659a6091db8d7d6` 精确保护。
- 原 toggle / advanced / outer-close：7,599 B / `f4e8f5b669190ba3b864577fdf6f9a748f1fd6c50d7981705ba78464a8798829` 精确保护，关键 private nodes 不在新长页 namespace 内。
- whole WXML 的两处 edit inverse 精确恢复 `6b9348f72e03f955bb8c19b6c3996270eeb52d19bdcc76134a53c200eb9f2a7f`；旧 CSS 全 byte prefix 保持，JS/JSON byte 相等。
- 原 long 15 个 inline chevron child attrs 全一致；产品 blue / muted SVG 的 path / stroke2 / 24 viewport / 14 原维度及 #1d64f2 / #94a3b8 paint 相符。新 12/14 px 消费由 CSS 决定，没有改旧 glyph。
- Chrome 仅 CSS cascade 观察：37 组源/新 role、208 属性；所有实质值相同，6 个 boxShadow 序列差异只是 Tailwind 的两层透明零阴影，实际非透明 source shadow 完全相同。源 `space-y` sibling margins 10/8 与产品对应 flex gap10/8 等价。源及产品样本 system font-family 一致。

CSS 观察只读用户源、已缓存官方 Tailwind；所有外部 image/font binaries 阻断。浏览器自闭合 WXML textarea 投影先发生 help locator timeout，后来只投影本批两个长页 scope；这是临时 HTML harness 与 WXML 的差异，产品没有因这些 timeout 修改。随后 static checker 初次用 source.index 定位重复 SVG，错误计位；改为 match.start 后原 15 个 source glyph 得到准确位置，产品未改。错误与修正均写入限定 proof；没有以它们声称 native 编译故障。

未写样式镜像单元测试，未运行业务 VM / 全量 / 历史检查 / 微信 CLI / SDK / CUA / Git。此结果只证明冻结源码/准确来源/绑定与隔离，不证明微信实际 text wrap / emoji paint / 像素 / 点击或外部环境。

## 根代理定点验证建议

- source scope `.me-long-reference` / `.me-long-hosted` / `.me-long-tools` / `.me-long-menu` / `.me-long-invite` / `.me-long-danger`。
- 本人已获授权正常 READY 数据：检查源尺寸和真实 hosted title/status/date/location/示意说明；hostedPreview 为空只检查原 empty guard。
- 已有隐私入口 `.me-long-privacy-request button`：点击只展开旧 `#privacySection`，不提交 DELETE；原 advanced 展开后样式与所有表单/合法提示保持。
- 对应真实菜单/主理工具与邀请原 one/many/none 条件按根已有真实 actor 做有限点击。退出仅实际 session / 非 development，原副作用不改。
- 最终根 CLI main/package budget、affected-route SDK 和独立 source review 尚待根执行；本报告不代替这些验收，不把本批等同全部 39 个页面或真实正式资源已通过。

## 独立审查后的最终两处来源修正

根已授权独立审查聚合的两项表现修正：原 settings 四张卡都在同一 `grid-cols-1 gap-3` 中，因此 public help→about 的唯一相邻 margin16改为12 px；既有人工请求按钮只增加 `hover-class="me-long-privacy-hover"`，用准确 `text-decoration-line:underline` 承接 source `hover:underline`。没有改变动作、守卫、文字、JS 或 advanced。

`review-delta-proof.json` / `review-delta-check.py` 仅局部核原 grid 和 hover token，并逆除两个 CSS edits / 一个纯表现属性，whole WXML/CSS 精确恢复上述初始冻结 SHA。初始26检查、37/208 CSS观察、63动作及保护证据保留历史阶段，未重跑它们或全量。初始产品副本与 manifest 保留 `frozen-product-before-review/`、`frozen-owned-paths-before-review.json`；新文件使用最新 frozen manifest。

| 最终产品 | Bytes | SHA-256 |
| --- | ---: | --- |
| me.wxml | 24,324 | `d53c91bcb8e8087745f37c1e42bcbf1d877d8ffe347720211f2619475524ab05` |
| me.wxss | 32,935 | `88e84dd895d782257102f55c89bf5ebb374808716fddbb1e284796bda2bf1923` |

最终本批 runtime raw 净增 **14,011 B**（review纯表现delta +127 B），仍0新资产/字体。最终独立局部复核与根 native SDK / CLI 尚由相应 owner 完成。
