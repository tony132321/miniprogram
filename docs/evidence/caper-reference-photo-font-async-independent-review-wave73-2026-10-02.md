# Wave73 共享图片组件与异步字体独立审查

## 结论与冻结边界

只读审查未发现具体产品缺陷。普通首页7个owner产品保持冻结；本次不改应用、不运行3+3已过VM、历史source checker、SDK、CLI、Git或全量测试。JSON旁件保留一次必要的新700轮廓/advance核验、两个官方固定WOFF响应与实际12键/图片源字节投影。

实际字体载荷为 **260,198 B / `1702d6644db3e5998132bacfe7d7067e37367148d6b8668327b5f066e7379b32`**。root旧source-proof的253,314 B/e7f与source.json净增20,327 B是明确已通知的“首页新增5字符”阶段；当前进一步加入发现源稿6字符，实际净增27,211 B。它是待root刷新阶段metadata，未当作产品错误。

## 图片组件

- 12个键与源manifest完全一致，所有值只指向固定 `/subpackages/profile/components/reference-image/assets/KEY.jpg`。实际12张合计806,316 B，与原URL响应分别整字节相等；首页11张683,581 B、公园122,735 B。未重编码/缩小。
- `Object.freeze`固定字典；`Object.prototype.hasOwnProperty.call`排除原型键与任意源地址。未知key得到空串，先前src会清空；内部image的`wx:if`随之移除，复用组件不留旧照片。
- `virtualHost:true`、`styleIsolation:shared`、`externalClasses:['photo-class']`与消费者接口一致。原几何class通过photo-class传入内部image，内部只声明display:block和aspectFill，页面持有尺寸/圆角/裁切。index JSON的usingComponents/placeholder指向真实profile组件和view。
- 根既有原型native48×48/r16、12 JPEG getImageInfo、未知key清空已读；普通virtualHost选择器harness失败仍保留，不借其失败或修正宣称本次全页native通过。

## 异步字体与登录

- SDK/dataURL及loadFontFace早期guard与immutable70整段字节相同。低SDK、无API或系统信息异常仍安全返回；缺require.async返回unavailable，同步throw和import Promise reject收口为failed/空数组。
- loadFontFace单face throw/fail均settle为failed，成功为loaded，重复回调只结算一次；normal/原weight/global/webview参数沿用原设置。源码不把字体Promise串到登录Promise。
- App整文件与immutable70字节相同：先设置独立api.login ready，再保存referenceFonts状态，onLaunch不await字体。来源失败不会阻塞登录，不调用身份/业务状态写入。
- 全项目引用只剩App→loader、loader→真实profile/fonts异步路径；没有旧main font-data dangling消费者。

## 字体字节、许可、旧字符保护

- 四Plus Jakarta400/600/700/800、Rubik Mono One400、专用Caper Jakarta Profile500的完整record（family/weight/Base64）与immutable70完全相同，顺序不变。仅Caveat700载荷扩大，末尾新增Caveat600。
- `const OFL_COMMON_BODY`起至license exports结尾的整个原后缀字节一致；完整Caveat/Jakarta/Rubik版权与OFL、Rubik原CRLF仍保持。未截断许可或删旧font。
- 最新Caveat700有39 Unicode；旧28个逐字的decomposed轮廓、advance/LSB完全相同，head单位和hhea/OS2行度量相同。新增11为 C/V/b/c/k + E/H/O/T/u/v，不假定新的字形只靠metadata。
- 独立只必要取得新700和600的官方fonts.gstatic.com固定URL响应各一次；均200且和保存WOFF/实际Base64解码字节完全相等：700 **28,076 B / f2fb6438cd2a04f9bcbb67fea2f9136208a99693156a533d1e2d8f28fb9628cd**，600 **11,624 B /65a31f27c6f651920868421bc775a63546e843e478f66b137fe52f5069098379**。保存的官方CSS SHA、family/style/weight与元数据相符，OS2实重分别700/600。
- 城市hand原CSS请求400，原可用Caveat仅600/700，按[W3C字体匹配规则](https://www.w3.org/TR/css-fonts-4/#font-style-matching)推断应选600；CSS不改成700。☺/♡/⚡不在新增font cmap，按原fallback，未伪造“所有Unicode均在Caveat”。

根既有8回调证明异步架构可运行，最后扩大后的700回调/本页和发现实际字形需根最终SDK单项确认；本只读审查不重跑或扩大native验收。

## 本次读取的产品hash

| 路径 | 字节 / SHA-256 |
| --- | --- |
| `miniprogram/subpackages/profile/components/reference-image/reference-image.js` | 423 / `29d3932022e981b3653a4bc7ef9f254caa1a40032b614498a160f6fac18c3c54` |
| `miniprogram/subpackages/profile/components/reference-image/reference-image.json` | 19 / `6bcc2e9e536384851fcfbdd823aee8ae4331243636adc4a656a64a44d9cf9318` |
| `miniprogram/subpackages/profile/components/reference-image/reference-image.wxml` | 94 / `9d8bda97c58e05c9fb6529579d597110d8b785bef37983eb15d8e3da3f523d6b` |
| `miniprogram/subpackages/profile/components/reference-image/reference-image.wxss` | 37 / `d95eeeee9e69d48c863905ec90f755b4be1e07101dace48ff0247a949d2000d7` |
| `miniprogram/subpackages/profile/components/reference-image/sources.js` | 1262 / `fb7cfd1d6d87de5685276f84c79c18af20481f82d5610b8de47111a77c312512` |
| `miniprogram/utils/reference-fonts.js` | 2450 / `620a72c3fd665990db2fd94b80c8db6158bf42c9e178632ab158564dc88741a2` |
| `miniprogram/subpackages/profile/fonts/reference-font-data.js` | 260198 / `1702d6644db3e5998132bacfe7d7067e37367148d6b8668327b5f066e7379b32` |
| `miniprogram/app.js` | 556 / `540105f1b42f5695519da2f36e4bf8e3399cbecdfc2347ffb0838965e04fce69` |
| `miniprogram/pages/index/index.json` | 340 / `3f3022dfdd20e7a99f602b8f8fc6af5b0082e8d99a56d3e67a6d170300ec198a` |
