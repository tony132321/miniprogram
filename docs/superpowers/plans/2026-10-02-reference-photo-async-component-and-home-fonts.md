# Wave 73 原稿照片分包与首页手写字体

用户要求原稿完整复刻、图片不降质、接通当前功能、并行、不要全量。实际 Wave71/72 main2010442 B，仅86710 B空间；首页11张新的准确原响应683581 B直接入main不能通过。3张原响应同byte复用，共212485 B。当前profile955308 B，可以容纳新的准确图片。所有图片仍仅是原稿场景示意，不是API真实活动照片。

root 已于2026-10-02直接读取微信官方[分包异步化](https://developers.weixin.qq.com/miniprogram/dev/framework/subpackages/async.html)全文，保留原HTML `/private/tmp/caper-wave73-wechat-subpackage-async-doc.html`。该官方合同允许配置 componentPlaceholder 后跨包组件下载再替换，要求基础库>=2.11.2；当前测试3.17.2、本工程3.17.3符合，正式环境仍要实际验收。

## 根独占实施

- 在profile分包新增唯一轻量原稿图片组件与准确静态原图，主页通过usingComponents/componentPlaceholder加载。组件只允许明确原图key映射，未知key空态，既有真实动态活动图片保持旧image，不扩后端或用户文件读取。
- 使用 virtualHost / shared样式与明确external class保留原image精确尺寸/裁剪/布局；先在隔离工程验证native CSS、真实getImageInfo和异步加载后同byte图源，再接入完整11消费者。若官方合同或实际编译不支持主包跨包组件，保留未接入边界并继续查真实可用实现，不用强行跨包src或假称通过。
- home owner只普通长页markup/CSS/SVG/source证据，根给稳定组件接口后仅补必要src/tag delta，不动businessJS、core、70状态。root独占app/shared font/config与Git。
- Caveat700子集在原全字体上准确扩 c/V/b/C/k；原city slogan实际400请求而只有600/700可用时匹配600，需准确注册600或局部family匹配，旧700 consumer/其它faces字节保护；☺如原字体不含glyph保留fallback，不伪称Caveat轮廓。Permanent Marker是否真正绘制先核源码fallback。

仅对新组件解析/未知key/身份无关只读加载和准确字形做必要检查；纯样式不镜像测试。只对本次受影响homepage图源/布局/入口及最终CLI包体定点验证，完整旧项目、全部页面/CI不运行。以实际freeze/source hash/SDK/CLI为准，不推广为真机、原生点击或39屏全部完工。

## 实测主包预算后的共享字体搬移

三长页新代码/准确SVG加新的字体超过原 main 剩余 86,710 B；字体数组原封整文件搬到 profile/fonts/reference-font-data.js，主包仅 loader 通过官方 require.async 下载。已有 7 faces 中 6 个不变；Caveat700只准确扩5个Latin glyph、旧outline和advance全等，新增600匹配原city nominal400请求。所有许可导出字节保持，loader Promise失败只记录source failed并resolve readiness，不阻断登录。只运行新增3项 loader异步/下载失败/旧SDK定向测试与微信8回调实测，无旧全量套件。原型CLI main1,778,717 B/profile2,016,120 B；这是共享组件/font probe，尚不是三长页最终包门。

## 最后固定文本字符增量

独立固定消费者审计发现，发现页700的 Wukang Road 还缺 W，已有 PG01 nominal400 的 Play More（最近可用600）还缺 y。只从原700/600字集增补 W/y，分别29172/12256 B；所有旧outline、advance、LSB和全局metrics不变，6个其它face与许可suffix保持。最终模块262502 B，相对原同步模块232987 B净增29515 B；上一阶段260198 B并非最终payload。独审证据与最终CLI/8回调的具体版本分列，不重跑已有VM或全页面测试。
