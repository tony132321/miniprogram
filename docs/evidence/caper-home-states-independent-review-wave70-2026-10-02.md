# Wave 70 首页 B / C / D：独立来源审查

## 结论与边界

已完整读取三份原 HTML、实际查看原 PNG，并独立核 frozen-product 的真实数据 / 62 动作契约、全字节保护、40 个准确 SVG 与 2 张授权原 JPEG。单次保护和字形核对通过；首次聚合 8 类纯表现 source 偏差和收尾漏列的 3 个 source 常量均已由 owner 最小 delta 修正，并完成独立定点逆除。下文保留首次冻结和纠正链；本报告最终对象是第 7 节 complete 快照，不是早期中间版本。

只读产品，唯一新增本报告和 `/private/tmp/caper-wave70-home-independent/` 审查证明。未运行实施者 93 项 checker、业务测试、全量、CI、SDK、微信、CLI、Git，也没有改产品 / 配置 / 字体 / 总矩阵。实际微信支持、按钮点击、截图和包体由 root 的限定证据负责；源 CSS-only 观察不代表实际字体加载、字形绘制或微信平台生效。

## 1. 精确原输入与首次 freeze

| 原文件 | 字节 | SHA-256 |
| --- | ---: | --- |
| PG02-B HTML | 27,642 | `c4bc70b16e1d4a6f3762f699efdc5c8414cf54fcc01158c2d01bfa3b739ad6a7` |
| PG02-B PNG | 546,434 | `e2580e22077bc9c3842eedbb871ade551bfd4bb557e3a1e01d9bca67e3a59ac1` |
| PG02-C HTML | 23,196 | `513bdc25f790648b29bbbd61813eb919f725f35ec46f1c124b01b15397346f64` |
| PG02-C PNG | 532,266 | `d14f895318eed0a0ef55e1c71144e257f9598a3a3aeac242fda97b3bebd5e6ac` |
| PG02-D HTML | 22,993 | `b084f0285633b0d8b6796006419204385a7c5752953d73ef15bb6280b5579698` |
| PG02-D PNG | 625,803 | `6426787ddd76ed42b7c69f11c22569f7fa952a9a8bfc31e63666b21f8e6bbd47` |

来源用户解压目录 `/private/tmp/irl-stitch-original/stitch_design_system_generator/pg02_b/`、`pg02_c/`、`pg02_d/`。完整原文件及 ZIP entry 原字节对应记录在 `docs/design-sources/caper-home-states-wave70/source-original-proof.json`；HTML / glyph / photo 等完整来源在同目录。原 PNG 用于视觉参考，不据其比例猜 px 或主观字体。

首次产品 manifest `/private/tmp/caper-wave70-home/frozen-product-paths.json`，17,157 B，SHA `8fe1db5a4fe3c709261d8ac310c398a0b9079de246f8deb2fcefcc1724d345b2`。只读 44 个冻结副本均与 manifest 同字节：

| 首次产品 | 字节 | SHA-256 |
| --- | ---: | --- |
| index.wxml | 36,480 | `791f7bb0e7062973d7e38dbb00d188afd43d903a19b6294a0b66a6ca1407b4d4` |
| index.wxss | 78,034 | `2d0e3411470396a63250e50301a20201fd7b3a7a48eca2322c83ee7dadbed751` |
| protected index.js | 32,598 | `d85b9db816163c4853bd2a7a9abec66dc62e8047d9e79c19457f4cb57dc8ac11` |
| protected index.json | 143 | `a082db2fcb674d4131b60f427fcb40891d00e1d2571e372df9827fa25e2f1fb1` |

44 产品为 WXML / WXSS +40 SVG +2 JPEG，首次 raw 净增186,836 B。raw 字节不能替代微信 CLI 编译体积，也不能宣称主包门槛通过。

## 2. 一次聚合、准确最小 source 修正

已复用此次等待期间唯一一次原稿 CSS-only 观察，三页共94 /95 /80节点；原字体二进制、图片及未知请求均阻止，不调用产品 / 微信 / SDK / 接口。原节点实际级联证明在 `pg02_b-source-css-observation.json`、`pg02_c-source-css-observation.json`、`pg02_d-source-css-observation.json`；原 generated Tailwind CSS 同目录 `*-style-2.css`。没有按 class 书写次序推断级联。

| 类 | 原稿 / 实际 CSS 明确值 | 首次产品偏差 / 限定修正 |
| --- | --- | --- |
| tab 颜色 | B 非 selected：surface-container-low #f4f3f8；C selected label：surface #faf8fe | `.home-state-reference .tab`共用 #efedf3；C selected共用 #fff。只限定 B 非选中底色与 C selected字色；其他状态不动 |
| tracking-wide / wider | wide=.025em、wider=.05em；B 13px poster-line .325px；C confirmed 11px poster .275px、footer-caption .55px；D memories sticker / date .55px | 对应现 .65 / .55 /1.1 /1.1 /1.1，均多一倍。限这些 source 节点，不更改真实文字 |
| 源默认 headline tracking / 主办 pill | C banner headline 没 tracking-tight：17px→-.17px；D history title 同样-.17px；C recruiting 主理人 text-label-sm700，confirmed 额外 font-semibold600 | 当前两标题-.425；C recruiting pill共用600。限定新标题和真实已授权招募主办 pill700；confirmed600正确保持 |
| B 状态专属色 / weight | WAITLISTED capsule：on-surface-variant #424655；RECONFIRM_REQUIRED poster-line：vibrant-lime #d2f803 /700 | 当前候补#1a1b1f、重确认海报行继承#cdf200 /800；只恢复相应 source 状态 |
| D 反馈卡 image / status capsule | 第二 source card 无 filter；右上 capsule 黑40%白字、padding2px 8px，无绿色dot | 当前反馈继承第一卡 saturate(.85) /contrast(1.05)，绿色第一卡 capsule/dot。只限定真实 `primaryAction==='checkinSection'`反馈分支；真实label保留，不制造评价状态或人数 |
| C poster shadow 层 | 招募第一卡 drop-shadow-md 在白底 pill 外层；confirmed 第二卡无该 filter | 当前以text-shadow仅给字，且confirmed继承。原层filter准确恢复、confirmed无影；不新增素材或猜 shadow |
| 源 motion | B /C orb是双层 ping1s；C neurology pulse2s；D inner orb pulse2s；B requested amber点pulse2s、warning bounce1s；C recruiting白点ping1s | 首次新scope无动画，orb只有单点。按原keyframes / easing /opacity及实际状态恢复；其他状态静态，不构造新计数 |
| 源 pressed / transition | B banner scale[.99]；三稿tabs .95；B cancel /reconfirm scale[.98]、waitlist .95；C campaign /share /arrow .95；D实际card buttons .95；source active:bg按原背景 | 首次 scope 没有这些纯表现状态。仅native hover-class等准确表现，不改62动作 / guards。C `active:scale-98`未定义，不能猜.98；关闭相册等没有新的成功动作 |

ping 为1s cubic-bezier(0,0,.2,1) infinite，75% /100% scale2、opacity0；双层orb第一层base opacity.75，第二层静态lime。pulse2s cubic-bezier(.4,0,.6,1) infinite，50%opacity.5。bounce1s infinite：0% /100% translateY(-25%)及cubic-bezier(.8,0,1,1)，50%translateY(0)及cubic-bezier(0,0,.2,1)。只限原有效CSS，不把原未定义 token补成设计值。C原`active:scale-98`与各`py-0.2`均不具有效果。

以上已一次汇总，不要求新业务、新增假人物或扩大检查。owner修后只核增量和逆除首次freeze；不会再跑已通过的62 contracts /40glyph /26模板逆除。

## 3. 准确已核来源与 R1 边界

原56px header、32px标记 /头像、44px通知按钮、24px blur、16px gutter、原圆角 /主要shadow来源有效。原status /胶囊不从PNG重画，沿用真实 `statusBarHeight`、`headerPaddingRight`与sticky header；长标题或实际五分类的必要限宽属于native适配，不把源四分类替换真实协办。B176px hero、28/28px900 italic poster、17/22px700标题、13/18px metadata；C16:9 hero、20/26px700title、22/28px700统计、44px action；D176px /160px feedback、17/22px800title、13/16pxbuttons在映射结构中保留。第2节列出的源级联差异应定点改正。

CSS scope只有pending /organized /history；source卡scope只匹配REQUESTED /RECONFIRM_REQUIRED /WAITLISTED、已授权招募shareReady、CONFIRMED /IN_PROGRESS、COMPLETED。额外安全状态、协办、普通首页和长页不被新selector命中；取消 /过期 /审核 /暂停保留既有闭态与真实文字。

真实活动ID、title、dateRange、venue、capacity、registrationLabel、cardNote、hostCounts和history日期照原projection读服务端；没有源静态头像 /参与者名单 /2、3、8等计数 /AA人均额 /已清算 /微信群 /天气 /旧新时对照 /候补顺位 /已等待 /星级 /相册数量 /授予勋章。原caption内容改成真实能力说明，不复制源DOM伪成功：原B script直接把按钮改“已确认”未接入R1。

- REQUESTED /RECONFIRM_REQUIRED /WAITLISTED仍到同ID报名区，首页不直接确认参加。退出 /规则快捷入口仍由当前状态判定。
- 真主办招募需APPROVED +recruiting，才有工作台 /公告 /shareReady分享；confirmed与进行中管理 /签到仍原资格。
- 完成主办再来一局仍走hostRepeat的同ID /版本 /账号 /safety核对；完成成员feedback仍同场checkin入口。AA读取由原资格决定，相册可见关闭且无handler。
- 原openCardAction /openEvent当前账号、items whitelist和action whitelist不改；没有新POST /成功态 /权限。

这些是原数据 /绑定未放宽的保护证据，不代表重复验过每个API。root限定同ID /真实角色 /页面状态点击并记录结果。

## 4. 官方 full-face SVG 与授权原图

40 个 actual runtime SVG 全部直接与已留存官方原完整 Material实例path比较，非相信filename / manifest。使用Wave69原full Version2.972 /v374、wght400、FILL0 /1、fixedopsz24 /GRAD0；没有字形path舍入。原full WOFF2 1,136,920 B /SHA `77f9711f3f896a1d7a34ab95cffc45cfb17d84c223f197c1b90faa0d043006e9`，独审实例化已确认 decoded TTF3,200,992 B /SHA `cf46fa438e9ce2265958fdea4498c31ae5b7b39cb172ebff4f6aedb5aedcbc90`。40项的product path、source full path、manifest path、viewBox、case-normalized fill和WXML引用全部相等。

smart_toy /favorite FILL1在原full active latn rclt下实际换为smart_toy.fill /favorite.fill。原同名sourceNodes只是候选，不能将一份paint任意给全部候选；实际consumer颜色 /尺寸按HTML上下文和本报告的状态映射读核。许可证继续Material Apache2.0，字体binary只docs /临时，主包没有新font或整库。

Jakarta沿用400 /600 /700 /800原faces，没有新增global500或profile alias scope。原B海报最终CSS900，原100..900请求失败边界仍保留，不能凭空生成900font；实际fallback /face matching不由本CSS-only观察宣称通过。

| Runtime JPEG | 字节 | 原下载 / 产品同字节 SHA |
| --- | ---: | --- |
| C organized-badminton | 50,486 | `127a013960fb752eccf0bc9e89146d60d6a3b5f12f67ccfbca1dc42e7c760dd0` |
| D history-badminton | 61,936 | `a02ca85ada6835044e0e2056cf231c71a744a4e93a83601e6a9abb93d73d8c6a` |

独立读取原HTML确认两URL确实原稿literal，产品与保存下载原bytes相等。WXML仅当真实既有badminton示意cover、对应状态和分类时切换源图；明确“配图为活动类型示意”。B三张主题、C骑行与D野餐五图没有runtime引用或入包，未把不支持的主题伪装当前真实记录。照片原字节相等不能称它是当前用户活动摄影；B图片、额外notes、真实计数与卡片总高属于明确未完全等同整PNG的边界。

## 5. 单次独立保护证明

`/private/tmp/caper-wave70-home-independent/independent-frozen-source-protection-proof.json`，61,269 B，SHA `bb4930c41bc56e33ea80c6379625fae8422ea1eac0f6fc781b77213c954ff270`。

| 独立核对 | 结果 |
| --- | --- |
| 44 manifest产品 | 字节 /SHA全部等于首次freeze |
| 26纯模板projection逆除 | 完整恢复immutable Wave69 WXML24,707 B，SHA `fcbf2764f06abb13207f5534b51bb7c93f563fd42ad4de3ddc55bda424a60da0` |
| 旧WXSS | 完整47,655 B前缀逐byte相等，SHA `5fd04b24883cc3a89188e989e4d04f9ba70ece8d4d9f88916380e07dfceb6aa0` |
| JS /JSON | 与immutable Wave69完整逐byte相等 |
| 62真实动作 | 顺序以及tag、handler、data、value、disabled、id、open-type和完整wx条件 /循环祖先均相等，无missing /new |
| 40 glyph | 原full /manifest /product path、axes、viewport /fill和literal consumer全部相等 |
| 2照片 | 原URL存在且保存原JPEG /产品逐byte相等 |

首次未完成观察因44产品freeze未包含受保护JS /JSON而读错快照位置；改读未变仓库两文件并按immutable核SHA后完成。只修观察器路径，不改产品，也没有重复任何已完成checker。WXML观测仅将合法valueless wx:else与Mustache里的raw ampersand /less-than规范给XML观察，原源不变；不是微信编译结果。

## 6. 后续限定 delta / native 验证

8类source差异实施后，独审只读取其新decl /纯结构，逆除恢复本首轮已经通过的freeze和保护，不重跑旧93项或本报告glyph /bindings。root负责实际微信动画、pressed、长真实数据、胶囊、按钮同ID /角色跳转、最终包体；native CSS支持不能由本静态报告替代。

## 7. 最终 source delta：独立定点结论

Owner 初轮八类修正仅增纯表现 WXML / CSS；独审已确认 11 处 WXML delta 可以逐项逆除回首次 `791f7bb0…`，修正 WXSS 的追加段 7,775 B 可逆除回首次 `2d0e3411…`。修正后的 WXML 38,653 B / SHA `b972b559a2c523f2b1c7ca794023595fe6fee94a90add1527a3ef1cce7204c81`；该阶段 WXSS 85,809 B / SHA `dd1a1dce6b4e154d03ab5454b0fa2a78b2052b24214f40a2db888973a53e540b`。42 资源的冻结元数据、受保护 JS / JSON 元数据均未改变，未重读整套字形或动作证明。

D 反馈右上黑 capsule 原 `backdrop-blur-md` 明确有效；owner 中间修正误设 none，已在最后阶段改回 blur12。此限定纠正保持其黑40% / 白字 / 2×8px / 无绿色 dot 正确值。独立修正链证明 `/private/tmp/caper-wave70-home-independent/independent-final-source-correction-delta-proof.json`，1,594 B / SHA `75903fa6675396ab8f4986e2cc376d57a71736d6bdf93899fb30f26fca7b57fc`。

收尾同一 source 色 / 标签组又发现 3 个初轮漏列字段；已明确告知 owner 与 root，不能把第一次聚合当成穷尽发现。仅定点修正：

- C 已确认 / 进行中第二海报字：原 `text-surface`=#faf8fe，恢复该色；招募海报保留自己的源颜色。
- D 反馈左上粉贴纸：原 `shadow-sm`=0 1px 2px rgba(0,0,0,.05)，恢复此影；右上黑 capsule 不增影。
- D 第一历史卡真实“AA 活动”中性标签，仅限定 `history-repeat-card`：原 2×8px / r6 / 11px14px700 / .22px / blur12。继续显示真实中性文案，不造已清算或人均金额；反馈卡额外 AA 标签无原第一卡价格映射，保持既有额外真实数据几何并明确边界。

独审只逆除上述两条已定义 rule 的新声明与末尾一条追加 rule，准确恢复前一 `dd1a1dce…` 整份 CSS。WXML 不变；42 素材元数据与前一阶段相等，没有新增绑定、素材或虚构记录。三处累计 CSS +356 B；证明 `/private/tmp/caper-wave70-home-independent/final-three-constants-delta-proof.json`，1,605 B / SHA `7a513a7f0204b01743fa61898b7f8688cd28f6f21fd12d550538eb343b77bb64`。

最终 complete manifest `/private/tmp/caper-wave70-home/frozen-product-reviewed-complete-paths.json`，副本 `frozen-product-reviewed-complete/`。最终 WXSS 86,165 B / SHA `27b11080f2eb16d8a2280567b697a3edd0d7af3e4158bc341d7a44146dcd0cea`，WXML仍 `b972b559…`。首次 raw 净增186,836 B，加这次纯表现 delta10,304 B，总 raw196,784+356=197,140 B；这只是 source 字节，不是微信编译包大小。

现有明确来源差距已修正，没有要求扩大业务或再运行已通过检查。实际 native 动画 / hover / blur / focus、同 ID 点击、微信截图与包体仍只采用 root 的限定实测，不能由本来源逆除报告宣称整体 PNG 完美一致或项目验收完成。
