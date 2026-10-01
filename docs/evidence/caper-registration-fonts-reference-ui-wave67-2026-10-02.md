# Wave 67 报名确认字体与实际许可资源

root独占全局字体数据及H3资源清单；沿用已验证的原loader与app初始化。原稿pg05可见Caveat为固定Good People／Great Rallies；原Same Game, New Friends!节点hidden sm:block，在原max425范围不可见，不添加假字形。Rubik Mono One标题为BADMINTON TOGETHER，原请求normal400，CSS italic为原稿合成样式；不新增未使用Permanent Marker。

准确原字节官方WOFF及CSS、固定Google Fonts commit9710da1eacb3be272583c3224dcb70f9da6eadbb metadata／OFL在 docs/design-sources/registration-fonts/。4040 B Rubik400为13 Unicode、14glyph、无variable axes；union Caveat700为19336 B、28 Unicode、79glyph，无variable axes，保留首页两固定句并补唯一新增R。其详细官方URL、bytes、SHA、文本和metadata在source.json。服务器WOFF响应为准确字节，未宣称它们本身是Git仓库blob。

原5face改为6face：Caveat旧18280→union19336 B；四个Jakarta400/600/700/800 family/weight/Base64完全不变；新增Rubik400。全局数据模块186228→193256 B（只root来源注释变化，最终hash另核），Base64净增6796 B，模块原始净增7028 B（不是实际编译贡献）。没有改loadFontFace、支持版本门槛、成功／失败回退或原登录／API逻辑，不重复既有5初始化VM或67字体检查。

Rubik完整OFL原为4462 B CRLF。与旧OFL共同正文精确等价，只把已有COMMON BODY的LF转成CRLF并拼其原版权前缀，导出逐字节与官方原文件相同；旧Caveat/Jakarta完整导出许可逐字节不变。官方文本随docs原字节保留，可能存在官方尾空格，不自行润色正文。H3清单由9改实际10项：5依赖＋2图标＋3字体，补Rubik版权，Caveat及Jakarta用途说明更新；H3所有业务JS和事件绑定不动，文案数量不是新增页面已验声明。

root已独立VM加载前/后数据，验证6face／两个WOFF byte/hash/axes/weight、4原payload、3导出许可与官方同字节。此为必要来源/许可检查，不等于微信字体已加载或所有字形逐像素。新runtime的Rubik／Caveat R及10项资源布局将作限定检查；尚无此处运行PASS。Mac本次computer use刷新仍锁屏，原生待用户解锁；不跑全量／CI。
