# CAPER PG06-S 分享背景接入 — Wave 71

## 范围与冻结

基线 Wave 69 `b45a99d0749fd1c4a14f88fa588b244b6a844a4d`，以 root 当前 QR require 无损分包迁移作为 JS 唯一既有例外。仅修改 activity/share 的 WXML、WXSS；没有改 JS、JSON、全局字体、配置、矩阵、Git 或运行微信工具。

产品冻结 `/private/tmp/caper-wave71-share-background/frozen-product-paths.json`，SHA256 `47fe3fdfddea336379fc94ae67f42db6e23a22300101c80d6ea558507cbb0c2f`；产品副本 `/private/tmp/caper-wave71-share-background/frozen-product/`。独占来源目录 [source manifest](../design-sources/caper-share-background-wave71/source-manifest.json)。

| 产品 | 字节 | SHA256 |
| --- | ---: | --- |
| share.wxml | 18,371 | `ce0132c7578ec2b4a1b6a1d4f528c2566e29819a72e7dc7f17ffec01aa272a60` |
| share.wxss | 32,129 | `c49dc766a42b6e37bbab256a4262417ad0ca991c53f9c6f3f1d67f3ef199cd4b` |
| share.js，原字节保护 | 27,268 | `8ab001ad92a8e911fc8b7e84934872d418a9d541c506ce42efbce1472373ab3d` |
| share.json，原字节保护 | 75 | `95f4181c4eb25045c994138c56d0741f84443d00426599975f8a3fe4f24e4262` |

## 来源和层级

完整读取原 PG06-S HTML，实际查看原 PNG，两个原文件与用户 ZIP 对应 entry 同字节，来源 SHA 分别 `ae332500609017a0a0d467d88b52ff0942e3b2824dc542e8f5bd65e5e18527c5` / `25784a100075b14dccb1f3e0b0a562df4ffc9f5ef90f5dacfa900138a4b848f0`。原稿前景已有 Wave 69 接入；本批仅追加原主办 Dashboard 的背景。

只有 `shareSheetOpen && loadState === 'READY'` 显示 `.share-background71`。旧普通 `_3` 分享卡、旧 Wave 69 前景模板及样式全部 byte exact。背景为不透明 fixed layer 40，位于旧前景 layer 50 下面；没有新增 button、bind、open-type、canvas 或路由，且 `pointer-events:none`、`aria-hidden`。关闭原前景后新背景消失，旧 `_3` 卡片恢复。

56 px 源内容 header 保留，系统状态栏使用实际 `statusBarHeight`，右側采用原 `headerPaddingRight` 胶囊排除；原居中标题在真实剩余 flex 空间中居中／截断，不复制 9:41、信号、Wi-Fi、电池 mock。所有新值是原 CSS 的 px，原安全区 `env(safe-area-inset-bottom,0px)` 继续使用。

原 PG06-S 中 hero 照片及 scrim 是 `-z-10`，hero 自身没有建立 stacking context；原 PNG 的首卡图与白文案实际几乎不可见。本批保留这项真实 source paint 层级，没有擅自把照片重新提到前景。该负层级在 native 的实际绘制仍须 root 限定截图核验。原正确羽毛球照片同 URL 复用本页 `sheet69-badminton.jpg`，原字节 40,193 B / `277b7d72221482111ee7799a958cd0c08ee7897fcb60f31900d1fcc68f293769`，页面保留“原稿场景示意图”说明；其他真实类型沿旧 cover classifier。

## 来源值与真实字段

- 原 16:9、p16/r16 hero；22/28/700/-.55 标题、11/14/600/.22 badge；13/16/600 日期／粗城市；旋转 -6° 的 p4×10/r8／blur12 sticker，11/13.75/800/.275 tracking。
- 四列统计 gap8，p10/r12，22/22/800/-.44 数字、11/14/500/.22 标签。当前 GET stats 没有取消数，第四列沿 R1 工作台映射真实 requested／待审核；没有复制静态 6、2、3、0。
- 成员卡 p16/r16/gap12，17/22/700/-.17 标题。share 当前不加载 roster，一个 44 px 通用符号和明确“未加载成员名单”说明替代不存在的头像，没有凭 confirmed 伪造人数图形、照片或 +1。
- 原浅蓝／紫助手卡、36 px FILL 1 lightbulb 和准确 13/17.875 正文。说明其只读快照，不声称 AI 已建议、提醒已发送或场地已预订。
- 成局条件仅绑定真实最低人数、当前确认数和 `venueStatus === 'HOST_CONFIRMED'` 声明；不复制 source 的 3 天或未经核实的倒计时。声明不代表场馆锁位，成局仍需既有人工确认。
- 三个 source 操作卡是无行为的背景 view；前景真实分享动作完全保留。底部 13/16/500 的文字 tracking 是 .325 px；原第二行只有 arbitrary `text-[10px]`，继承 body 21 px／400，tracking1 px／opacity .7，没有误补 15 px／700。

没有向背景绑定邀请码、sourceToken、具体地址、用户 ID、支付金额、假人物。既有 share.refresh 的 host 身份／账号切换／版本／生命周期／安全和邀请码有效期流程不改。Source 字体请求 400／600／700／800，源 500 声明保持声明，使用现有匹配行为；未引用 profile 500 alias 或扩字体。

## 字形、成本和单次保护核验

12 个 glyph 全部复用同 activity 分包的现有资产，实际比较原后置 Material full v374/2.972 的 w400、FILL0/1、opsz24/GRAD0 contour／paint／alpha，见 [source reuse](../design-sources/caper-share-background-wave71/glyph-source-reuse.json)。`lightbulb` / `check_circle` 的 FILL 1 均应用原 active rclt 到 `.fill`。没有用名称代替准确轮廓，没有新增图形或照片二进制。

**新主包 raw 0 B；activity 分包模板／样式 +18,656 B；新 runtime 资产 0 B。** 最终编译预算由 root CLI 实测，未以 raw 推称已过编译门禁。

一次限定 source／资源／隐私字段／动作／保护检查 **22 项通过**，保护原 **16 个实际动作节点**。见 [实际输出](../design-sources/caper-share-background-wave71/targeted-source-binding-proof.json)。最初 checker 的 bytes/str startswith 类型错误仅修 checker，产品未改变；随后单次完整核验通过。

新增背景 chunk 精确逆除恢复整份 Wave 69 WXML；追加 CSS 精确逆除恢复整份 Wave 69 WXSS；JS／JSON 保持本批初始字节，JS 的 root QR 单行 require 再逆除精确恢复 immutable 69。全部原动作、data、aria、disabled 等参数同字节。没有重复原业务、全量、CLI 或 SDK。

## root 需限定确认的运行边界

真实 host 的同 ID share 页面打开前景，确认背景 `.share-background71` 出现、原 foreground 的复制／微信分享／生成海报／关闭仍作用于同 ID；仅需核实际底层 canvas 的 native 遮挡、layer40/50、源负 z hero 和真实胶囊/中文换行。关闭后背景消失、旧 `_3` 仍完整；非 READY／资格失效／账号清理保持旧 guard。没有把本静态检查当作 native 点击、真机、全部 39 屏逐像素或外部环境验收。

## 独立复核的两色修正

仅将新未满足成局条件的 background `#fff4de`／color `#8b5710` 恢复 source 中性 `#efedf3`／`#424655`，保留真实“仍需核对”与全部条件。局部逆除精确恢复原冻结 WXSS `219f0221…`，字节长度不变；初始 22 项 source 检查没有重跑，原输出与初始产品副本完整保留。见 [定点逆除证明](../design-sources/caper-share-background-wave71/pending-neutral-correction-proof.json)。新 native 绘制／canvas 层级仍待 root。
