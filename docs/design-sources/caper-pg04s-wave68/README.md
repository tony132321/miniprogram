# PG04-S Wave 68 准确 Material 来源

完整原稿来自用户 ZIP 的 `stitch_design_system_generator/pg04_s/code.html` 和 `screen.png`。具体字节、ZIP 身份和来源文件hash见 `source-manifest.json`；完整原图已有解包原件，不复制PNG/JPEG进入运行包。

原稿先请求四轴 Material range，随后又请求同 family/style/100..700 range 的 `wght,FILL@100..700,0..1`。第二个等价face覆盖第一个：`original-second-request.css/.woff2` 保留原请求加精确icon_names subset的官方原字节，`original-second-decoded.ttf`只去掉WOFF2容器。其fvar仅FILL0..1/default0、wght100..700/default400，未提供opsz/GRAD变量；后两者固定24/0。源 class `font-weight:normal`，本页span没有显式font-bold；source check_circle节点唯一显式FILL1。Google官方规则见[Material Symbols指南](https://developers.google.com/fonts/docs/material_symbols)。不按字号猜opsz，也不将本页close22换成600 back。

`material-fill0.css/.ttf`与`material-fill1.css/.ttf`是官方精确24/400/FILL0或1/GRAD0请求字节，Version2.972。15个小SVG由精确GSUB ligature轮廓经FontTools4.60.2的y翻转导出，没有重新画轮廓。`material-manifest.json`包含每个source URL/hash/version、轴、glyph、unicode、显示px、颜色、path、运行路径与bytes/hash；限定检查逐个证明导出path与原第二variable face的400/FILL0或1实例相同。没有字体二进制进入miniprogram。

第一次直接读原WOFF2因临时Python缺Brotli失败，产品未变化；`fonttools_node_brotli_bridge.py`用已经存在的Node内建zlib.Brotli解码，未安装依赖、未改共享helper。原失败和实际解决均保留在source-manifest。解码输出不是新的字体设计。

许可：原 Material Symbols 为 Apache-2.0，原文在 `docs/licenses/material-symbols-Apache-2.0.txt`，hash见source-manifest；本批没有增加第三图标库或全局字体。旧 source asset／许可不改。

运行图片复用 `/assets/stitch/pg04s_badminton.jpg`（63131 B，SHA256 `8d4c18256599f7d9ab5ff629947156507b40da2315fd5e0b4a88434471c0bdbe`），保持可见“活动类型示意配图”。不使用示例头像、人名、固定星期、虚构口令或假自动邀约结果。

## 最终成功 mark：PNG 外观优先

根代理在本批实际截图对照中确认，完整给定 `screen.png` 的成功 mark 是绿色描边圆圈和绿色 tick；HTML第17行却写FILL1，导致原HTML来源实心绿色圆 / 白tick。用户要求1:1视觉复刻，根明确决定这一节点以给定PNG外观为准。现仅将其引用改为准确官方后置同face的400 /FILL0 /固定opsz24 /GRAD0 `check_circle`，颜色仍#34C759、显示仍36px。原FILL1资产和来源记录保留为HTML历史，没有改其他14字形、JS、CSS或组件几何。

新 `pg04s-check_circle_fill0.svg` 856 B，SHA `a4b04b9903d61e6c90cf012bdba7c6a0bc8ebc35c4b1fea4b97284a0afb1ceb6`；轮廓直接由原 `original-second-decoded.ttf` 400/FILL0实例导出，没有重画或舍入。单项证明见 `success-mark-png-override.json`。这是有明确PNG/HTML冲突决策的视觉订正，不把初始15项HTML一致检查改称PNG一致。本次不重复原185bindings /55refs /全来源检查或SDK；根随后只拍此mark并测最终包。
