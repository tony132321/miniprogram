# Wave 71 PG02-N2 紧凑通知中心：来源恢复、真实路由和限定检查

2026-10-02。唯一实现 owner `/root/ui65_font_audit`。根计划 `docs/superpowers/plans/2026-10-02-compact-center-live-monitor-and-share-background.md`；用户要求全部原稿 UI 接通现有功能、复用旧工程、并行推进、不要全量测试。N2 的原 HTML 没有来自 N1 的入口；按根已授权默认决策使用“更多”菜单，而非声称用户未答复就批准某个具体布局。

## 1. 原始来源和实现边界

原 `pg02_n_2/code.html` 19,462 B / SHA `0c9f0bf0d8fcf45ef781477c3dfa0339ebfb9823080b61b530bed746ac36c32c`，完整 HTML 和 screen.png 与用户 ZIP 对应两个 entry 字节相同，见 `docs/design-sources/caper-compact-center-wave71/source-zip-original-proof.json`。完整原 PNG 已实际查看，原 HTML 已完整读。基线为根 immutable Wave 70 `d78b2464b4c97a17ddf4f0c13dc692ae892ba250`，`/private/tmp/caper-ui70-immutable-illt8q2z`。

N2 为现有 CENTER 下的 `centerLayout:'CARDS'|'COMPACT'`，原 N1 卡片布局仍默认。没有新增 page、后端、消息记录、支付、群聊或导航服务；只改变呈现与必需菜单。原稿例示人物、金额、相对时间和活动名称均不覆盖 API 真实数据。来源字段缺口导致整 PNG 不能逐像素等同静态样例；本批只主张新布局来源结构、准确可用素材与真实功能的限定恢复。

来源已有一次 CSS-only 浏览器级联观察被原样复用，不重跑浏览器：`source-css-observation.json` 与三个 `source-style-*.css`，原浏览器 154.0.8037.93，观察中图片/字体请求受阻，因此该观察只证明有效 CSS，不证明真实原字体绘制或原生小程序表现。来源中 `font-label-sm` 是 family token，单独写它不会取得 `text-label-sm` 的 700；活动红 badge 实际10px / 400 / leading-none，正确保留。

## 2. 精确 UI 映射

只新增 `.messages-compact-reference` scope，原 CSS 全 56,674 B 前缀不变。当前状态栏位置与胶囊保留已有 `statusBarHeight/capsuleInset` 适配；不能把浏览器零 safe inset 当作微信原生安全区。

| 原稿角色 | 本批实际 selector / 值 |
| --- | --- |
| body | Plus Jakarta Sans /16px /24px /400，#faf8fe；沿用已注册400/600/700/800，不用 profile500 alias |
| fixed header | 56px，侧16px，blur24，rgba(250,248,254,.8)，0 1px 8px rgba(0,0,0,.04) |
| header controls | 44px触点，back24 /more22，person32圈 /18 glyph，Event Detail17/22/600/−.17px |
| pills | section上下4/8，row上下4/gap4，按钮32px/侧12px，13/16/600，selected#1d64f2与原primary20%小影，未选#e9e7ed |
| activity badge | 实际已加载活动未读，10/10/400、16px高/min16、侧4、#ff2d55；aria明确“已加载”范围，不用总未读数假冒 |
| stream/cards | feed上4/gap12；card12px padding /r12 /gap8，双影0 4px 20px −2px rgba(28,41,61,.06)+0 1px 3px rgba(28,41,61,.02) |
| reminder ambient | 原4px高度、.8 opacity、电蓝→紫→lime，未替换为 N1 粉色渐变 |
| card content | 圈40/glyph20/上2；title17/22/600/−.17、truncate；time11/14/700/.22；summary13/21.125/400/上4 |
| reminder thumbnail/actions | 原56×56/r8；两36px胶囊/18 glyph/gap4；实际示意标记额外说明，签到与当前地点复制 |
| approvals | 原details在前/approve在后，32px/侧12；28px匿名占位替代不存在的真实头像，未制造2人/Alex/Momo |
| update /milestone | 原pill上8/p2×8/icon14；原chip上10/p6×8/r8、点8、chevron16；真实活动详情动作 |
| footer | 上32/下16；handle32×4/下12；17/22/600/.425px/#73768760%；副文11/14/700/.22/#73768740%/上4 |
| pressed /animation | card .99、button .95、原150ms/cubic(.4,0,.2,1)；source pulse2s/cubic(.4,0,.6,1)。原DIV改真操作button的两个链接抑制默认额外hover；secondary明确原hover#e3e2e7 |

来源 CSS 没有 N1 大号“通知中心”和“全部已读”行；N2 不强加它们。全部已读仍可切回默认卡片布局使用原功能。Footer 英文视觉原文保留，原宣称 AI 服务的副文换为真实“活动动态与站内通知 · CAPER”，不宣称 R1 有 AI 消息服务。

## 3. 精确字形与原图

新资源8个 SVG 共4,476 B；3个 header SVG 直接复用 Wave69 已有准确 path/viewport/fill，不复制文件。全部11个源消费者在 `glyph-manifest.json`。源最后 Material face 是已保存官方 full v374 /Version2.972，WOFF2 SHA `77f9711f3f896a1d7a34ab95cffc45cfb17d84c223f197c1b90faa0d043006e9`，decoded TTF SHA `cf46fa438e9ce2265958fdea4498c31ae5b7b39cb172ebff4f6aedb5aedcbc90`。只实例化本页实际400/FILL，固定24/GRAD0，SVGPathPen准确Y反转，不舍入/简化。FILL1 alarm/bolt/fmd_bad/check_circle均经选中latn rclt lookup1到`.fill`，不是仅改FILL轴后跳过GSUB。官方 font binary 不复制进应用。

准确新消费者：alarm20/#1d64f2/F1；confirmation_number18/fff/F0；near_me18/#1d64f2/F0；bolt20/#ff2d55/F1；fmd_bad20/#647700/F1；location_on14/#4d5d00/F0；check_circle20/#34c759/F1；chevron_right16/#737687/F0。许可复用 `docs/licenses/material-symbols-Apache-2.0.txt`。新匿名审批占位复用原 `wave69-person-blue.svg`，明确不是源真人人像，也不是另一项虚构参与者。

原 N2 首张羽毛球图使用完整相同 HTML URL 实取 HTTP 200，28,623 B / SHA `36c2ece6538bb2cd91a5be6a218c9380bc70c8e02cb87a9de015fdb56246eb10`，JPEG 原响应未重编码，`photo-manifest.json` 保留原URL、最终URL、响应元数据/hash；运行 `assets/wave71-compact-badminton.jpg`。实际页面标“示意配图”，不冒充真实活动现场。原 Alex/Momo 两个人像不下载为真实报名者。来源第5卡 wallet 没有真实 R1 付款通知合同，没有导出未使用图标、假¥45、去结算或假支付记录。

## 4. 真实数据、按钮和闭态

| 原稿卡 | 实际 R1 数据 / 动作 |
| --- | --- |
| 即将开始 | 原 present() `EVENT_REMINDER`；openNotice继续真实checkinSection，copyReminderVenue沿用当前本人确认报名、event ID/version/review/status与现地点重读守卫，文案是“查看现场签到 /复制地点” |
| 待审核 | 当前 `/me/approval-requests`；原registrationId/expectedVersion/isHost/canApprove/approvingId以及原审批API保持；details先、approve后仅源顺序改变 |
| 地点更新 | 当前 `MATERIAL_CHANGE`；原openNotice→重新确认区；显示真实actionLabel，未称坐标定位或导航已提供 |
| 成局 | 当前 `EVENT_CONFIRMED`；原openNotice→活动安排；不称AI已同步群日程、交流室已开启 |
| 原付款卡 | 没有匹配R1付款通知，不插假卡。其他真实通知仍展示actual tone/icon/title/summary/externalHint/actionLabel及原openNotice，没有新的支付服务 |

同一 `items/centerItems/filter/approvals/snapshot/nextOffset/approvalSnapshot/approvingId` 在布局互切中保留对象和值，不重新读 API、重置分页或放松资格。未登录、加载、失败重试、无结果、审核失败/加载和两个分页沿用原真实闭态。没有假头像、未发生的消息发送、金额、送达、入群或地图定位状态。

18个新动作中17个原 CENTER 业务动作契约完全保留；唯一新增动作是授权更多菜单 `openCenterOptions`。N1更多原通知设置变为同一菜单，菜单仍委托原 `goNotificationSettings`，不改原个人页intent/路径或身份清理守卫。所有action绑定在 `bounded-source-binding-protection.json` 保留actual data/id/version/disabled/wx条件与祖先loop记录。

## 5. 新菜单失效保护

只允许当前 CENTER 的 CARDS/COMPACT；捕获当前actor+session完整identity key、generation、layout、requestId，回调仅合法数字tapIndex0/1，所有捕获值仍匹配才执行。账号/session在回调前改变会沿用原private数据清理并停止动作。onHide、CENTER入口、返回INBOX、进入关闭私聊均推进菜单requestId，避免离开后再回同模式的旧回调重新生效；新菜单覆盖旧菜单。refresh使用原generation失效机制。只有布局setData后scrollTop0；不刷新通知/审批，也不扩权限。

初始、账号切换清理、approval focus和重新进入CENTER均默认CARDS。匿名身份只能布局/原设置的已有安全入口，通知仍UNAUTHENTICATED且空，没有新API访问。无wx.showActionSheet安全返回。新增loaded活动计数只由现有displayed()已加载collection投影，账号清理归零；过滤别类不将计数误当过滤后总数。

## 6. 验证证据和保护

仅新 `test/miniprogram-messages-compact-layout.test.ts` 七个有意义行为用例：真实collection/筛选/审批/分页保留且零重读；已加载activity计数与后端100总未读分开；双布局旧settings；账号/session轮换；hide/refresh/模式来回/新菜单失效；默认/清理；非法selection/非CENTER/不支持/匿名闭态。先RED 7/7（缺新方法/状态/投影），再GREEN 7/7；日志均保留来源目录。原生 wx API 的受控 VM 是本地逻辑证据，不当作微信UI点击通过。没有照搬样式的测试。

执行命令仅新file：`node --import tsx --test test/miniprogram-messages-compact-layout.test.ts`；Node --check messages.js通过。用户明确不要全量，因此不执行技能通用指南中的全量suite；也不跑历史通知、审批、字体、全页面、SDK、CLI或CI。

一次必要 source/资源/保护检查已通过：完整WXML inverse=原25,349 B；完整JS inverse=原30,972 B；原CSS全56,674 B prefix；JSON和25个旧assets byte保护；完整WXML结构parse；18actual新actions中17旧business contract Counter相同；11消费者精确glyph path/paint/viewBox与4FILL1 GSUB；准确JPEG响应hash/未重编码。检查器第一次提取old scope漏开始view造成辅助脚本stack错误，修辅助提取后成功，未修改产品来迎合检查器。

之后仅两source DIV-to-button关闭默认hover与一source secondary hover规则自查订正，`final-source-press-proof.json` 逆除精确回已通过检查模板，绑定条件/旧prefix/其他业务均未动，不重新全跑以上检查。

冻结产品和预算数值见 `/private/tmp/caper-wave71-compact-center-prep/frozen-owned-paths.json` 与 `source-manifest.json`；原始净增只是源码/素材字节，不等同实际微信包体。实际编译、native capsule/scroll/中文截断/源animation/菜单点击和同ID跳转由root新路线限定验证；本实现自查不是独立review。没有真机、上线或全部39原稿完成结论。
