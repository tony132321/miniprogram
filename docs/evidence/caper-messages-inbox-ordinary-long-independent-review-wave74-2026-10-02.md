# 消息 INBOX 普通长页独立来源审查 — Wave 74

日期：2026-10-02。审查者 `/root/ui64_review`，实现者 `/root/ui65_font_audit`。只读审查普通长页冻结产品、原 `caper_3` HTML / PNG、48 个来源 CSS 角色和实际旧 / 新 WXSS 级联。没有运行作者 71 项脚本、历史测试、样式镜像、业务 / 全量 / CI、SDK、CLI 或 Git 操作；没有修改产品。

## 输入和来源

完整用户原 HTML 已阅读，原 PNG 已查看：HTML 32,137 B / `18fab22c6b92592673e19574739eb2ed86cbfb0fe628023ec5dcd3b843a1aa6b`；PNG 210,560 B / `85fc42cb05ea57b3afe81c594917572ead3122dfa5feb958595574fb5901da1b`，290×1600 缩小长图。两件原件独立比对用户 ZIP，精确同字节。原 CSS px 取声明和已捕获官方 Tailwind 3.4.17 的有效级联；没有从缩略截图比例计算 px。

原系统 font-sans、12px / 16px 的 text-xs、11px / 16.5px、AI 12px / 19.5px、9px / 13.5px 标签等已对完整 48 个角色逐项读审。`py-0.2`、`shadow-xs`、`shadow-2xs` 是无效 token，未给它们自行推值。原 handwriting 配置没有本批可见消费者，无需新增字体。

| 48 个来源角色分组 | 独立审查内容 |
| --- | --- |
| main + recent 6 项 | 系统栈、原 16px 边距、p10 / r16 白卡、行 p10×6 / gap12 / r12、44px 圆槽、title12 / 16、tag10 / 15 / p0×6。 |
| event 8 项 | 白 card p12 / r16 / border1 / shadow-sm、header12 / 16、item p10 / r12 / gap12 / slate50 .7、32px badge / 原16px glyph、title / time / summary / helper 实际值。 |
| AI 9 项 | indigo900→slate900→slate950、p14 / r16 / shadow-md、128px 光晕 / blur40、40px orb / p2 / inner slate950、10px lime pulse、9px tag、12 / 19.5 copy、两种原按钮几何。 |
| mentions 3 项 | p12 / r16、row p8×4 / gap12 / r12、40px teal 匿名圆槽；明确关闭态。 |
| album 7 项 | 横滚 gap10、五槽96×64 / p4 / r12、18px / 28px emoji、原五渐变、11 / 16.5 title、9 / 13.5 note。 |
| history 3 项 | 原历史 / 归档 row p8×4 / gap10、32px / r8 emoji；闭态不生成记录。 |
| brand 4 项 | 原渐变 / p14 / r16 / blue100 .7边、14 / 20 / 900 / -.025em 标题、11 / 16.5 copy、贴纸6×8 / r4 / 9 / 11.25 / rotate2deg / shadow-sm。 |
| settings 3 项 | p12 / r12 / border1 / 无shadow、原 inline title 与父行盒、helper10 / 15。 |
| footer 5 项 | mt16 / pt16 / pb8、上9 / 13.5 / 900 / .1em、下10 / 15 / 700、24×1 线和8px间距。 |

原 main 的 pt4 / 固定390外框与现有真实通知搜索、身份、加载、审批、错误说明不是同内容、同高度。已保存的观察只含 source CSS，未测原生文字、字体、emoji 或图像；不以这些属性宣称整 PNG 像素通过。

## 首轮聚合意见和定点纠正

首轮只提出三处确切偏差，一次发给实现者与根代理：

1. 新 notice-description 仍继承旧 `white-space:nowrap` / `overflow:hidden` / `text-overflow:ellipsis`。原 HTML 292 / 306 的 summary 是没有 truncate 的正常 `<p>`，应在新范围恢复正常换行。
2. 归档第三卡的说明被 common history 样式设置为 slate500。原 505 行明确 `text-slate-400`，应仅该说明恢复 `#94a3b8`；其他历史 / 结束说明仍保持 slate500。
3. 设置源 535–536 行是父16px / 24px 中 inline title span12px / 16px，加 helper block10px / 15px。新 block view title 与父12px / 16px 丢失原匿名首行盒。应恢复正确 inline / parent 结构，不能以任意 fixed65px 修补。

根代理授权的三组修正已独立定点复核，最终 WXML / CSS 精确逆除回首轮独立审查的 `6e0c3b…` / `f9eff614…`。最终新增 only 277 B：WXML67 B / CSS210 B。摘要仅新 notice scope 恢复 normal / visible / clip；归档仅 amber 图标邻接说明恢复 slate400；设置仅标题改准确 inline text，父16 / 24、hint block10 / 15，无 fixed height。标题新专用 selector 覆盖旧 `.settings-row view text` 的 display:block；所有其他声明和真实文案保留。

归档两条原 selector 实际同为 **0,3,1**，adjacent 声明后置，已正确取得 `#94a3b8`。审查者曾在一条中间消息误数旧 selector 为四个 class，立即更正。实现者在更正前临时增加24 B显式范围，根代理随后要求严格撤回；正式产品、来源、doc和manifest均完整恢复最终 `acf81…`。此计数失误不作为产品故障，也没有继续扩大整改。

最终局部脚本保留两次辅助诊断：读取临时24 B snapshot导致预期 selector 找不到；随后“无固定height”substring误命中 `line-height`，仅改harness为属性 token regex。最终针对三组 delta 的 **13 项局部只读断言 exit0**，没有重跑首轮17项、作者71项、48来源观察或旧测试。完整失败原因与临时delta严格逆回证据在独占 JSON 中。

最近会话沿真实闭态保持中性“尚未开放”tag，@提到我的匿名闭态行没有伪造人物或消息，也不增加导航 / 假动作。这些闭态颜色 / 非交互表现属于明确的 R1 数据适配边界，不宣称与原人物彩色 category 或 active hover 完全同内容、同状态。

## 独立代码保护与图形

首次只运行独占只读审查脚本的 17 项必要断言，直接读取冻结文件、基线和原源。该结果不借用作者 71 项结果充作独审：

- 17 个初冻结 owned path 的实际 bytes / SHA 均符合 manifest。
- 独立逆除 14 个 WXML 表现替换，完整恢复旧 34,914 B / `69208a8ae7b49fef663ac51ef723f45248959b29aa0c3ad649507d174c0c1e13`。
- 旧 WXSS 67,613 B / `2b8787c83c01314c1a23b5d2549984c251e842180cd8206ee4553304f3907c7a` 是完整精确前缀；新增普通 selector 仅 `.messages-inbox .inbox-long…` 与一个独占 pulse keyframe。
- JS 32,969 B / `b297f95f560581abc5718b4fe35cb66453601f1e0948e6940800e4eb8e10a8c0`、JSON63 B / `b76e69c65eadf25397e0df5c9457c5a098c1bfc714ae05be5441318bdc8ebacc`、34 个旧素材均与基线同字节。
- 完整 CHAT + N2 + N1 的 23,282 B suffix / `c38173522a35fefec876eab293b7e25db1e6d70019d9952462857cd8fde6025f` 精确未改；整页 header / priority / approvals / 空状态由完整 inverse 同时保护。
- 全部63个 action 节点的 event / dataset / id / disabled / value / placeholder / aria-label / `wx` 祖先多重集合精确同基线。长页实际受影响仅6个合同，没有新增handler。新增AI次按钮严格 `disabled=true`，没有 handler / dataset 写入。
- 两个 new SVG 直接对原 HTML 285 / 299 的完整 child XML，精确同字节；wrapper16×16 / viewBox0 0 20 20 / fill`#059669`与`#f43f5e`准确，后者 evenodd 属性不变。总618 B；无新照片 / 字体 / 图标家族替换。它们仅按真实 `REGISTRATION_APPROVED` / `MATERIAL_CHANGE` kind 显示，原 INTERACTION 分组不被重新归类。

六个真实动作也只读核既有 JS：最近会话进入 CHAT_UNAVAILABLE 并滚到顶 / 隐藏 Tab；`openNotice` 只接受当前真实 items 的 id / kind / eventId，身份和 generation 守护仍在，打开对应 activity / profile 后记开状态；签到 / 补记子按钮仍是相同合同；loadMore继续 snapshot / offset 与身份守护；goDiscover实际 switchTab；settings实际写既有 profile focusintent 后 switchTab。没有编造聊天、批量AI确认、push授权、相册、归档、mute或通知记录。

## 最终冻结与限定结论

最终冻结清单 `/private/tmp/caper-wave74-inbox-long/frozen-owned-paths.json`：4,924 B / `acf81ad34d47af0e6a5a9c9e816026ec9ae921118b43998ac22becba64165e4a`。

| 最终产品路径 | B | SHA256 |
| --- | ---: | --- |
| `miniprogram/pages/messages/assets/wave74-inbox-people.svg` | 364 | `73eb0f340370629c4852237533cea9751888524a15b085e42b6f9c94f5f8adc6` |
| `miniprogram/pages/messages/assets/wave74-inbox-pin.svg` | 254 | `4fd6d2c2fb7de30ec688d4fec4b27d67c6e9b84a2b2aa77a9154ce88b3c22e50` |
| `miniprogram/pages/messages/messages.wxml` | 38796 | `db32d3f3a4061d472f579953efdbe4fd5af71ae8af5e5e4c5fb171f141ac4dd7` |
| `miniprogram/pages/messages/messages.wxss` | 82556 | `ca8454e7cc3e9f8892d14fbf9a5c5ac79517db8c4045222012c14e54456b6a89` |

本批 runtime raw 净增19,443 B，仅两 SVG618 B、新照片0 B、新字体0 B。独立来源审查三处修正已落实，**审查范围内没有遗留源码来源整改项**；完整初轮保护经局部精确 inverse 继续成立。该净字节数不等于实际微信编译包通过。

独占来源证据：`docs/evidence/caper-messages-inbox-ordinary-long-independent-source-proof-wave74-2026-10-02.json`，23,758 B / `97c99de066de967d2d2d0a94e1a14e54bef690c1417b66bffa7bff1a8a8a65bd`。

本独审仅确认最终冻结源码的来源纠正与旧行为保护；6合同不等于6次原生点击，63 action 声明不等于63条完整端到端验收。实际新范围原生绘制 / 图片 / 字体 / emoji / 实通知按钮由根代理限定 SDK 和截图另行记录，编译主包门也由根代理执行。没有宣称全部39屏完美像素、真机、正式AppID / HTTPS / 订阅消息 / 真人运营验收或整个项目完成。
