# PG06-S 分享弹层原稿恢复（Wave 69）

本批仅修改既有 `subpackages/activity/share/share` 的 `shareSheetOpen && canShare` 前景弹层。原 `_3` 邀请卡 WXML 前缀 6,897 B、CSS 前缀 13,329 B、JS／JSON全部字节保持；14个事件绑定及2个原生分享分支保持。入口仍先读取真实活动和安全状态，使用当前身份／审核／招募／风险／版本／邀请码资格，不注入授权。

## 原稿与实现

逐项读用户 ZIP 的 `pg06_s/code.html` 和 `screen.png`。恢复28px顶部圆角、16px容器间距、40×6把手、17/22标题、32关闭按钮／20图形、64×64场景图、四列48px彩色操作格、26/24图形、12px口令卡与15/20取消按钮。来源颜色包括 `#004cc8`、`#34C759`、`#efedf3`、`#e9e7ed` 和黑40%／4px模糊遮罩。只有新 `.sheet-reference69` scope 生效，旧 `_3` 卡完整保留。

8个 Material SVG 来自原最后一条同family／normal字体请求的官方woff2，实例为真实400／FILL0，保留精确路径与960单位Y翻转；关闭／日期／chat／photo_library／groups／content_copy／key／copy_all均有来源、轴、版本、SHA和显示尺寸。未新增全局字体或依赖，复用现有完整Apache许可。最初不完整UA返回7个静态face并触发来源前置断言，保留响应；全UA请求得到变量face后才生成资源。

羽球64px图使用原弹层背景URL的原JPEG（40,193 B）；仅既有类型判定选择羽球图时替换，其他类别沿用原真实类别选择。明确“示意图”，没有配虚构真人头像。最初Python取照片发生SSL EOF，普通curl验证TLS重取原URL成功，未绕过证书校验。

## 真实功能与视觉边界

现有分享准备、当前邀请码复制、真实海报导出、关闭／取消保持。图中永久口令／HTTPS链接改为当前邀请码；没有HTTPS域名，说明保留。进度条只在实际已确认数字与有效人数上限都有值时读取当前活动，两端文字明确已确认／上限，不冒充成局缺口或原示意6／8。分享准备前群聊仍为关闭说明，准备后才有原生选择分支；不伪造送达。

既有路由先进入 `_3` 邀请卡后展开弹层，因此模糊背板仍是实际邀请卡，未改为原PG06 Dashboard，也不宣称整个背景与原PNG逐像素一致。真实文字、示意图标注、安全区和系统胶囊同样需要保留。前景复刻与真实点击结果由根代理本批限定CLI／SDK证据补充，本报告不单独声明运行验收、真机或正式发布通过。

来源与精确保护见 `docs/design-sources/caper-share-sheet-wave69/source.json`／`protected-proof.json`；临时冻结 `/private/tmp/caper-wave69-share-sheet/frozen-owned-paths.json`。本批未跑全量测试。

独立审查用原HTML与既有Tailwind CDN做CSS-only观察（图片／字体二进制阻断，非产品实测），发现7处把font-family token误作尺寸token：状态／日期／人数／四格文字／推荐／口令首行实际继承body21px，推荐9px的tracking-tight为-.225px。已只改7条新scope规则，字距同步normal，真实text-label-sm的复制按钮14px／.22px保留；逆除严格还原初次冻结CSS，详见 `cascade-correction.json`，未重跑完整保护检查。

补充真实版本边界：本次subset实际v375／2.973；原最后CSS固定的fullface为v374／2.972。独立从fullface按原8个文本ligature解轮廓，400／FILL0路径与当前8SVG全部相等，见 `full-face-eight-outline-comparison.json`；不把版本号相同当作轮廓相等。原fullface源字节由本批活动来源目录保存，未进入小程序或增加新运行字体。
