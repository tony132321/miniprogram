# Wave65：准确原稿字体接入

继续用户已授权的UI一比一恢复，复用Wave64核心页面和Wave62说明页。基线本地 `6cf710ee750000d32639e5649466620bec2d6dac`。字体只读审计已完成；采用其原官方字节/hash/许可，不能另设计字体。仅首页两条实际固定英文加载Caveat700，H/H1/H2/H3按照原稿真实family节点映射Plus Jakarta Sans normal400/600/700/800；中文/☺维持原稿系统fallback、原mono语义保留。

五个官方静态WOFF135,672 B，Data URL Base64180,904 B。字节仅在产品loader存一次，原二进制保留docs来源证据不计入主包，不在包内再复制WOFF。准确许可/来源/版本/weight/cmap记录进入docs。官方微信3.7.9起支持Data URL，global登记必须在app.js执行；scopes限定webview，避免改变分享canvas。旧基础库/缺API/加载失败保留fallback，加载不阻塞原登录或API，不增加字体相关用户流程或提示。

## 并行职责

字体实现者独占：miniprogram/app.js、新miniprogram/utils/reference-fonts.js及仅一次Base64资源模块；首页仅调整需要的family声明（保持原Caveat），H四页WXSS和必要的WXML明确节点class；docs/design-sources/reference-fonts/、docs/licenses/{caveat,plus-jakarta-sans}-OFL-1.1.txt、docs/evidence/caper-reference-fonts-implementation-wave65-2026-10-02.md。不要动H3已真实许可清单JS；先通知根代理确切清单，后续根代理必要增加两条实际新依赖。其他页面/业务JS/共享CSS/总验收/Git/微信只读。

独立复核者等待实现freeze，仅核官方字节解码hash、desc字重、原稿节点映射与原中文/mono边界、App原登录不变、异常/未支持fallback。根代理独占Git/共享工具，Wave64不可变上传与本轮编辑独立。

仅必要font初始化VM检查：有API正常成功、单字体失败隔离、低版本不调用Data URL、缺API、同步异常均不阻止登录初始化。不要写视觉样式镜像测试，不跑全量/CI。实现freeze后根代理微信限定加载状态、首页两句真实字形截图及宽度、H四页原Latin/数字的实际字重/换行/胶囊和返回；字号不变不重跑已验业务矩阵。真实preview测主包低于2 MiB；超过预算则将仅使用的字体另做合法加载布局，不能关闭构建检查。

保持失败回调/实际字形/真机的证据区分；API成功和family字符串不等于真机全屏像素一致。最终独立复核、受影响编译/字形、必要凭证/cached差异检查后提交[skip ci]并上传GitHub；正式资源和全39屏验收继续保持明确。
