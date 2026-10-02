# Wave66：消息 INBOX、构思 IDEA、羽毛球访客详情

继续用户已授权的所有原稿UI恢复／真实R1功能目标，依照最新“并发、不全量测试”。阅读 `docs/evidence/caper-next-reference-gap-audit-wave65-2026-10-02.md` 和完整对应原HTML／PNG／当前页面／有效后置CSS。本轮3个独占实现者并行，不重新设计，不复制示例人物／日期／假生成结果；root独占Git、微信工具、总验收。原明确CSS px按字面值，实际宽度自适应；undefined h-13/h-84不可猜尺寸，原status/tab系统区域不复制。

## A 消息 INBOX

独占 messages.wxml/.wxss、新 messages/assets/及 `docs/evidence/caper-messages-reference-ui-wave66-2026-10-02.md`。业务JS字节不变。原 `caper_3` 首screen header包含brand/title/3filters整体sticky，p横20/正文16；品牌32、文字12/9，原search/settings 32圆/16精确inlineSVG，gap8；标题24、贴纸11与10/9、三筛选12/p6/gap8。优先卡p12/r16、heading内横4/下8、通知行p8x4/gap12、标识40/badge16/title12/time10。保留真实未读数、实际通知ID/类别、ellipsis和所有绑定。新INBOX scope不得改变CENTER/CHAT_UNAVAILABLE及长页其他模块；共用header若当前已经复用要隔离。已有胶囊helper复用，实际56px控制行与status+capsule+8适配明确。每页仅一次来源/资源/绑定/保护区域检查，不增加视觉镜像测试。

## B 发起 IDEA

独占 create.wxml/.wxss、新 create/assets/、仅必要headerActionInsets几何的create.js、`docs/evidence/caper-create-idea-reference-ui-wave66-2026-10-02.md`。原 `pg03_ai` 56fixed头/横16、返回44/glyph24、草稿高32/p12/glyph17、profile32/glyph18；复用当前status/capsulehelper。原draft inset profile+34在32px圆后只gap2；恢复原gap8需最小+40，保持所有业务JS其他字节（先报告root）。IDEA主内容横16/顶8/栈gap20；80原orb、8x10眼/gap10/反光20x10/腮红6x4/lime粒子14/浅紫6°标签，重用源CSS层而不画新角色。输入卡r24/p16/min168、send40/glyph20/countdot6；灵感gap10/r18/p14/gap14、44/r14glyphbox及准确源emoji；原fixed底tray white82/blurxl/p横16/上12/下32+原生safe、主buttonpy14px24/glyph22/源gradient。保留真实手动入口与slow/cancel/disabled状态。不要给未定义h-13写52px。Material outlined名/weight/FILL必须精确核原source及已有固定来源；app只SVG，字体证明留docs。新增样式和markup限stage-IDEA，FORM/REVIEW/重大变更/真实suggest、字段/快捷日期/费用/保存发布保持；不新造网络假成功。本页仅必要源/resources/保护binding及最小新增几何VM。

## C PG01 普通羽毛球访客

独占 event.wxml/.wxss、新 event/assets/、仅必要native header字段的event.js、`docs/evidence/caper-event-visitor-reference-ui-wave66-2026-10-02.md`。范围须READY/detailsSection/no success/isBadminton/notHost/notCONFIRMED；joinConfirmation打开时底层不能覆盖弹层，generic/host/member/success/其他sections隔离。不全局改poster/detail-section类。

恢复源海报max425/4:4.8、原三色/18点阵/径向光/两SVG轨迹；球拍、皇冠、back/share/more、metaheart/money/groups等精确inlineSVG；calendar_today/location_on准确Material outlines。图形来源/childhash/transform完整记录，不把♛或CSS椭圆称同图。海报42/50/-2.5°、白tagp6x12/-1°、右badge border2.5/p10x14/r16；player原w256/top48/right-24/-3°，既有示意JPEG字节保持，h-84无定义不得猜高336。源36圆hit/back20/share16/more20/原玻璃色；胶囊必须按真实rect计算headerPaddingRight+8，复用项目已有header utils（root确认现用utils名称），JS仅初始化几何字段不动业务。叠层sheet-24/r32/p20x20x32、title22/pb20border；facts40box/r16/glyph20/gap14/rowgap16、真实copyVenue保留，不能假地图。hostp14/r16/avatar48/halo2及源meta两列/seatrow层级恢复但真昵称/人数/API条件不变；底部p20横14上32下+safe/gap12，joinpy14px24/font15，sharepy14px20/glyph16。保留审核、场地声明、取消规则、暂停、举报等真实说明区，不塞假主办主页或人员照片；真实未可报名状态继续禁用。

## 冻结与根代理验收

各自声明资源数量/hash、原HTML与图形source行／轴／许可、最小JS差异、全部绑定不变、被保护状态的字节／有效CSS边界。root当前Wave65字体资源及index/discover弹窗已freeze，禁止修改这些文件；Wave65 immutable提交/上传与本轮工作并行，root clone在Wave65完成前不会同步本轮WIP，避免串证据。

新独立review在三页freeze后核全scope，root之后完整同步本轮，并只查受影响状态/几何/路径：INBOX三filters/search/CENTER往返/设置和一真实通知；IDEA输入/灵感轮换/关闭类别/手动FORM往返/草稿或profile，无新发布；PG01一当前授权访客活动/原海报/sheet/copy/menu/确认打开取消，仅回看被排除host/member/成功/一section不串样式。native CUA可用时补真实点击。包体真实preview，主包<2MiB；不可放宽检查。必要凭证与cached差异检查、[skip ci]提交、GitHub同tree上传；不跑全量/CI，39屏整体、正式资源和真机仍按验收矩阵另记。
