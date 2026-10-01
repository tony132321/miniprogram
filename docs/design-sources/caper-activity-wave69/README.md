# Wave69 活动三域准确来源

原完整 PG06 / PG08 / PG09 HTML 已留存；完整 PNG 逐页阅读，文件路径、字节和 SHA 在 source-manifest.json。原 ZIP SHA 同表。源码样式、配置和原两次 Material CSS 响应按 bytes 留存。

Material 原后置相同 family/style face 覆盖前置 face，直接指向 v374 full WOFF2（Version2.972）；保存官方响应 URL/UA/header/hash。fvar 只有 FILL0..1 / wght100..700，默认0/400；24pt/opsz24与GRAD0固定。按字符 cmap→GSUB ligature、实际 full face 在400/700与FILL0/1实例导出 SVG；SVGPathPen+Yflip，不舍入。33种来源/交互态变体：30个新增运行资源、3个旧精确轮廓复用。

原ligature raw outline的 full 与先前 icon_names 子集33项中仅 check_circle700 / task_alt700有坐标差，运行资源已取 full 原路径。未以文件同version或名字相同冒充轮廓相同；未复制 font 二进制到小程序。来源 WOFF2仅本 docs；现有 FontTools4.60.2 / Node builtin Brotli 桥用于解码，不装依赖。

PG06照片与遮罩原-z10导致截图近白，按原 PNG 留此效果。PG08假二维码、中心A、假人物和原默认已选答案不作为真实凭据/事实；实际动态canvas240/扫码/输入/未选值保留。PG09原静态已支付/平均60/AI分类金额替换为真实费用与明确未开放。细分在 source-manifest.json。

字体边界以既有 caper-pg08-font-weight-boundary-audit-wave68-2026-10-02.md 为准：CSS900保留但真实可用face800，不新增900；原CSS500角色使用页面原family，不能借用仅profile的500 alias。当前100..900官方请求失败不能写成有效variable900字体。

bounded-scoped-check.json 为唯一142项定向源码/资源/绑定/保护检查；source-text-refinement-proof.json为精确文本/颜色/顶部水平内距定点校正（不重复142），并再次提供完整WXML逆除与旧CSS前缀证明。JS/JSON、51旧资源以及所有其它scope原模板保留。source-manifest.json记录原分段/整段hash，临时逆除映射保留供独立审查。

本证据是源码/来源证明，不含微信运行、真机、CLI、全量测试或上线结论。root负责限定实际运行和整包。

## 独立复核 FILL1 active rclt 定点修正

FILL1/wght400 的 DFLT/latn 活跃 rclt lookup1(Type1) 将 lightbulb/check_circle 再替换为 .fill。初版导出只做ligature，未应用这两项替换，故原FILL1来源断言不足。现已按activeGSUB准确导出 lightbulb.fill 与 check_circle.fill：修本页lightbulb，新增本页check_circle；仅PG06两处src转新asset，旧pg04s FILL1历史文件原bytes保持。filled轮廓／FeatureIndex／lookup／单项逆除／CSS-JS-JSON-其余asset保护在 fill1-rclt-correction-proof.json。没有重跑142。最终30新SVG＋3旧准确复用；33变体总数不变。

随后独立review按PG06:64/99/149仅修三个role：成员标题gap6、+N13/16/700、场地右二级13/18/400。pg06-role-correction-proof.json 有局部CSS逆除及WXML/JS/JSON未动hash，不重复142。

最终按官方Tailwind3.4.17 config.full.js:109纠正新Wave69 15处错误DEFAULT阴影的shadow-sm角色，并补PG06 native person同shadow-sm。准确0 1px 2px 0 rgba(0,0,0,.05)；旧131951B前缀及lg/xl/2xl/inner/custom/text-shadow不变。shadow-sm-correction-proof.json给出15+1局部逆除，未重跑142。
