# Wave 72 普通“我的”长页独立来源审查

2026-10-02。Reviewer `/root/ui65_font_audit`，实现者 `/root/ui64_review`。本报告是 me 长页独审，与 reviewer 自己实现的 N2 无关，不计作 N2 独审。根授权只读复核来源、全模板保护、真实19按钮及隐私请求入口；不改产品，不重跑 owner26静态检查、37角色/208属性CSS观察、历史业务、SDK、CLI或CI。

## 1. 输入和一次限定证据

完整读取原 caper_1 长页 HTML（438–751）及前置字体/颜色/soft/float CSS，实际查看完整PNG。原PNG192,288 B / SHA `8901eb5958e4ecb9a209d40992c0214e5e6b1d89b99a64b5eabea22df6bbb369`，原HTML42,473 B / SHA `37088f60630a26b0c2711c9ef018076d3ede9128cf33e5b7bf399fb66217faf9`。独立核两者与用户ZIP对应entry逐字节相同、docs来源HTML与解压文件相同。

读取最终冻结的 me 两模板、所有新append规则、当前业务JS相关字段与方法、真实服务端`/me/events` authorized projection。原始冻结manifest `/private/tmp/caper-wave72-profile-long/frozen-owned-paths.json`，15路径 /3,108 B / SHA `ff9658b325133ed6b7f77c7f2f11c80cff562bc8d1dbb1a908f62dc442e2fdbc`，全部freeze bytes/hash核实；产品副本 `frozen-product/`，基线使用 root Wave70 immutable `/private/tmp/caper-ui70-immutable-illt8q2z`，没有把 owner 自备 baseline 的存在当作当前通过。

独立一次必要证据：`/private/tmp/caper-wave72-profile-long-independent/independent-source-protection-proof.json`，12,471 B / SHA `0dbf58d1cb106f04b56972da82614f080722c132b270e4636fb589f00d5f7e6d`。源码 `source-protection-review.py` 为独立读取脚本，没有调用 owner checker，也没有运行浏览器CSS样本。

## 2. 旧区域和权限契约

| 独立确认 | 结果 |
| --- | --- |
| 全WXML两个实际新块逆除 | 精确回21,117 B / `6b9348f72e03f955bb8c19b6c3996270eeb52d19bdcc76134a53c200eb9f2a7f` |
| 核心首屏及法律同意前缀 | 8,667 B / `6ae94e81234c603fe2e13604751e356e5f614f19d18a5c27a659a6091db8d7d6`，完整保持 |
| toggle/advanced/原close | 7,599 B / `f4e8f5b669190ba3b864577fdf6f9a748f1fd6c50d7981705ba78464a8798829`，完整保持，privacySection未被新字体scope包裹 |
| CSS | 旧22,131 B / `c090c16406ddcb5b85f5cea37c5fc8581df0a5f7907b23c6f423daec2e37fb7d` 是准确全prefix，新append未改共享.card/section-head |
| JS /JSON | 与immutable70逐byte相等；53,362 B / `def9a36a9c46deca17cebbe95e5bd8672469eea6e759fd279b45d28c9f87021b`；63 B / `1bc6ec418e7c2ba28f9ec3a5479da2a73c9d8eb8066588dbcd128604a39a9880` |
| 动作树 | 原/新全页63actual actions，attrs与有效wx祖先条件Counter相同；19受影响长页动作，未丢dataset/qualification/实际handler |

唯一搬迁人工请求的原/新 node都是 `button bindtap=showPrivacyRequests`，且唯一effective ancestor完全同字串：

`{{(hasSession || developmentMode) && loadState !== 'ACCESS_DENIED' && loadState !== 'UNAUTHENTICATED'}}`

新的public外层没有引入额外访问入口；原auth/access guard被准确复制。原`showPrivacyRequests()`只委托未修改的`revealAdvanced('privacySection')`；实际revealAdvanced只设置advancedOpen及选择器/现status inset滚动，未调用DELETE、EXPORT或任何提交API。真实请求表单的原审核文案、按钮、业务方法仍处于保护advanced块中。UI明确提交申请不会立即删除账号或共享记录；没有将人工核查改成立即注销。此为源码/权限契约确认，按钮真实点击与表单滚动仍由root限定native检查。

## 3. 来源角色与字形确认

- 原系统font-sans（-apple-system/BlinkMacSystemFont/SF Pro Text/PingFang SC/Helvetica Neue）只用于新两个长页scope，未扩全局字体或改变advanced。标题14/20/900、6×14蓝marker，查看12/16/500、原14 chevron。
- hosted原12px padding/gap12/r16/slate100边/soft影，80×80/r12 illustration；真实title12/16/700，源进行中10/15/700+p2×6/r4且emerald50/600/200仅实际IN_PROGRESS；date10/15/slate500，真实可用place10/15/slate400，次级note9/13.5/500。不是源固定活动/场馆/人数。
- 工具原4列gap8、卡py12/r16、circle36/blue50、emoji18/28/400、文12/16/700，sourcehover blue200与150ms transition；数据看板实际关闭说明，不造成功动作。
- 账号/通知/帮助/关于原p14/r16/soft影、heading12/16/900、marker4×12；accountrows10px、其他rows8px；accountpy2/helppy4。真实说明多行不强行复制假手机号/设备/认证/checked push。
- 原邀请p16/r24/blue500→indigo600/float影，128px白10%blur24 orb/right−24/bottom−32；title14/20/900/−.35、gift16/24/400、description11/13.75/500，按钮p6×14/lime12/16/900/sm影/源press95与hoverlime400；旧直接text样式已定点重置，不继承旧字号/上距。
- Danger mt24、heading11/16.5/700/.55，logoutpy12/r16/rose200/soft影/press.99；原隐私面板p12/r16/rose50 60%/rose100，真实按钮12/16/700，说明10/15/rose400。Footpy24/10/15/700/slate300/.5。
- 15原inline chevron的path child attrs逐项相同：`M9 5l7 7-7 7`、round cap/join、stroke2，source24 viewport；两已有runtime blue#1d64f2 /muted#94a3b8资源与immutable旧bytes相同，无新增素材/字体。实际行12 /heading14消费尺寸由新CSS决定，没有改变已有SVG。

读取 owner 的一次CSS观察能补充有效级联与透明zero-shadow说明，独审没有重跑它，也不以208条存档样本当独立native绘制证据。

## 4. 真实数据及功能适配

已读取`me.js:419–421/461`：spread现authorized `/me/events`行再计算dateLabel/cover，hostedPreview为真实isHost的首项。服务端`src/server.ts:403–441`确实按原权限输出city/venueName；未审核字段原投影省略。新增place只在返回字段存在时显示，无假上海/静安。原场景cover仅示意，界面有“场景示意图”；没有把原参与者两色头像/+8当作当前管理名单。

19动作继续真实入口：邀请输入、主办记录/主理中心/发布/报名审批、资料/隐私屏蔽/通知/活动记录、帮助/缓存/关于/法律/公约、真实邀请、退出和人工请求。邀请保留原one/many/none资格校验，退出保持hasSession且非developmentMode。原原型收藏图/32/18想去、手机号/3设备/已认证、默认checkedpush、假v1.2.0不复制；源closed/真实文案造成整PNG形状或行数差异，明确属于R1合同边界。

保留原advanced入口使private菜单与public帮助卡之间仍有已有附加区域；这不是删掉真实表单来套静态模板的理由。独审指出的相邻help/about gap是两真实相邻源card的常量差距，与上述附加区域无关。

## 5. 一次聚合的两个必要修正

1. 原SettingsGroup是`px-4 mt-5 space-y-4`外层，里面只有一个`grid grid-cols-1 gap-3`子容器；账号、通知、帮助、关于4张卡全部在该grid内，所以彼此gap是12px。外层space-y4没有相邻子元素，不产生16px。产品`.me-long-public-menus > .me-long-menu + .me-long-menu`目前margin-top16px；仅该help→about相邻规则改12px，保留advanced和其他source规则。
2. 原Danger按钮明确`hover:underline`；搬迁`showPrivacyRequests`的新button没有native hover-class/underline。仅该唯一button增加表现hoverclass及scope的underline规则；保持原attrs/handler/auth/access祖先和advanced完整，不需要重复业务检查。

已一次把完整两项交root和owner，没有要求扩测或重写页面。修正前不称source-complete；owner修正后只需要local delta inverse和新freeze，不重新执行第2/3节保护检查。

## 6. 待根完成的实际边界

原freeze WXML24,288 B /`6854799062489ef6bf70e0ae29f0f9ca2cbf0e38ff98b7b50071df5438fed949`；CSS32,844 B /`1c5f6c235b4b36f58b1690e7d4b319cf855d1faae08620faf546b9f657601196`。这是修正前freeze；两项已按第7节定点解决。

源码新增13,884 B、运行素材0 B，不代表实际编译包净增。根后续只需19受影响入口中的必要实际路线、隐私按钮只展开旧真实表单/不提交DELETE、相关中文换行/native hover/scroll和本批最终CLI门禁。本文没有运行/声明微信点击、真实字体字形/emoji绘制、真机/上线或全部39原稿完成。

## 7. 最终两个纯表现 delta 独立复核

Root授权owner只修第5节两项；最终public相邻margin为12px，唯一showPrivacyRequests button添加`hover-class="me-long-privacy-hover"`，限定`.me-long-privacy-request button.me-long-privacy-hover`只设`text-decoration-line:underline`。没有修改业务attrs、auth/access条件、handler、JS/JSON、core、advanced或素材。

独审只逆除这一个36 B属性、一个新CSS规则以及唯一16→12常量；两完整模板精确回初始685479… /1c5f6c…，单个属性/规则/常量各出现一次。实际原完整HTML的grid在551行、hover在735行；owner初版552/741手录行号偏差已仅在来源metadata订正为551/735，产品没有变化；最终owned manifest3,712 B /SHA `99220ea3a8333bee22b6a57e4a6ffddff52eccdae7b6edb161ba100ae7497a90`，本报告及独立proof亦按实际输入行号记录。没有重跑第2/3节检查、owner26/37或任何SDK。

| 当前最终产品 | Bytes | SHA-256 |
| --- | ---: | --- |
| me.wxml | 24,324 | `d53c91bcb8e8087745f37c1e42bcbf1d877d8ffe347720211f2619475524ab05` |
| me.wxss | 32,935 | `88e84dd895d782257102f55c89bf5ebb374808716fddbb1e284796bda2bf1923` |

独立局部proof `/private/tmp/caper-wave72-profile-long-independent/review-two-delta-proof.json`，731 B / SHA `a1d02cd11e476730d2d71c3ca02b9cee867d491082976d769280b53d6bad1552`。这两个source差距已解决，无剩余本scope来源整改；runtime raw净增14,011 B（delta +127），仍0新运行资源/字体，不推断编译通过。root实际native/CLI边界继续第6节，本报告不是静态人物/全部PNG/39屏完工证明。
