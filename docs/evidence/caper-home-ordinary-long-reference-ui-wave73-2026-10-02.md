# Wave 73 普通首页长页原稿恢复（owner 已冻结）

## 范围与当前状态

依据已批准 `docs/superpowers/plans/2026-10-02-home-ordinary-long-page-source-restoration.md`，只恢复普通首页的 caper_2 长页与普通 footer。业务 JS、JSON、core 首屏、Wave 70 B/C/D、协办、邀请码、安全 fallback、共享 Tab 与全局字体均不由本 owner 修改。根任务单独负责分包图片组件、注册、全局字体、CLI/SDK/Git 与包体实测。

普通长页 WXML/WXSS、准确小 SVG 和 11 个分包原图消费者均已实施并冻结。冻结副本 `/private/tmp/caper-wave73-home-long/frozen-product/`，清单 `/private/tmp/caper-wave73-home-long/frozen-owned-paths.json`。唯一来源/资源/绑定/inverse 静态检查80/80通过；独审后3项source差异仅做19/19增量inverse。没有写镜像业务测试，没有运行历史套件、全量、SDK 或 CLI。根组件小原型已获其限定运行证明；本页最终完整native与包门由根单独验证，此报告不代替该结论。

## 完整来源

完整源保存在 `docs/design-sources/caper-home-ordinary-long-wave73/`：

| 来源 | 字节 / SHA-256 |
| --- | --- |
| caper_2/code.html | 48,084 / `e4e4ba417711e27838f10cef098c4da8c428d3b9d7c4217fe36d9def5761c4ca` |
| caper_2/screen.png | 278,231 / `81028ecae6d89d2b77c70750e628c1e58a355dd52704e2a3646dcf392934f13f` |
| 用户 ZIP | 24,668,856 / `df22e733d33fda20979b75b8a7bc94717c4a5c9e41561a54e3038432fab32603` |

完整 HTML/PNG、精确 URL/HTTP 响应、SVG 原节点与字形 paint、手写字体消费者、有效 CSS 观察和角色投影均留存。只读原稿 CSS 观察执行一次：原完整 HTML + 原缓存 Tailwind，无产品页面、点击或 SDK；字体/图片请求屏蔽，不能用作字体实际绘制证明。362 节点、0 pageErrors；源 `from-black/85` 有效。源唯一未定义 token 为旧 core 的 `py-0.2`，本范围不补猜值。

## 原稿几何与真实内容映射

| 模块 | 原稿有效 CSS / 当前真实映射 |
| --- | --- |
| 推荐双卡 | 外 gutter16、py8、双列 gap12；cover112；body p10；title12/16/700；meta10/15；footer pt8/mt8/border-gray100。保留两个 closed inspiration handler，日期/人数/样例头像替为示意说明。 |
| 品牌横幅 | h176/r24/p20/soft；85%→60%→30% 黑色渐变；title20/25/900；smile28；手写16/24/700/−3°。 |
| 热门与主题 | 热门四列 gap8、固定外壳80/r16/mb6/overflow-hidden/sm，只有内部图hover scale1.05；title11/16.5/700；两层 caption9/13.5。主题96/p10/r16/1px border；四原 emoji 和 amber/sky/pink/emerald 原色。活动与人数不伪造成公开列表。 |
| 我的活动 | 原112px 横卡、112px cover、gap10、p8、title12/16/700；沿用 `homePreviewItems` 当前账号活动、`item.id/title/cover/dateLabel/statusLabel` 与原 `openEvent` 条件；保留无活动提示。 |
| 构思 | 原 banner p12/r16/15% 三色渐变、list p12/r24/soft、row p6/pr56/gap12、photo48/r16。原 `space-y-3` 先绝对 doodle 后首行，首行实际 mt12，未误去掉。真实本地羽毛球草稿与其他 closed inspiration 原动作保持。 |
| 拼贴 | h256、12列、main7/right5、gap8/p4/r24；右两图原50%高+8px gap；黄贴纸 max110/p10/r12、bottom−8/right−4/+4°。手写18/22.5/700，原两层filter drop-shadow，明确取消旧text-shadow。照片明确是视觉示意。 |
| 说明横卡 | 原宽224、gap12/p12/r16/淡色边框/sm；quote12/12/serif；body11/17.875/500；footer mt12/pt8、symbol28、title12/16/700、caption9/13.5。保留真实功能与安全说明及 `goAbout/goGuidelines`，不复制 Lina/Kevin 或用户评价事实。 |
| 城市横幅 | h192/r24/p20/soft；黑90%→50%→透明；title20/25/900；lime button p8x16、12/16/800、glow。按钮仍 `goCity`；手写12/16、原请求400、−3°。 |
| CTA / footer | py24、card p24/r24/soft、bulb40/r16、title18/28/900；button p14x24/r16、14/20/800、原三色/floating、plus20；footer pt8/pb24、原品牌与实际 about/privacy/support 路由。 |

新增 CSS 只在 `.home-long-reference` / `.home-long-footer` 下，旧 86,165 B WXSS prefix 整字节保护。原源 soft / shadow-sm / shadow-lg / floating / glow-lime 按准确有效值，shadow-sm 为 `0 1px 2px 0 rgba(0,0,0,.05)`。原可用 hover 的主题色、热门 image scale1.05、灰色链接、城市 lime、CTA opacity 均局限本范围；外置 SVG 不能继承原 hover currentColor，灰色箭头用同原 child 的 gray400/gray600 双 paint 消费，不增加业务方法。

## 准确图源与容量边界

`photo-response-manifest.json` 留存 14 张原 HTML 完整 URL 的 JPEG 响应，状态200、完整 headers、原字节 SHA-256 与 no-reencoding，合计896,066 B。已有 cache 未能先证明同 URL 响应，按原 URL 重新取得后做整字节比对；3张与工程原有 JPEG 完全相同，按现有路径复用：

- 美食69929 B：`/assets/stitch/caper_home_dinner.jpg`。
- 徒步91338 B：`/assets/stitch/caper_home_hiking.jpg`。
- 上海51218 B：`/assets/stitch/caper_home_shanghai.jpg`。

其余11张683,581 B由根原字节放入 `/subpackages/profile/components/reference-image/assets/home-ROLE.jpg`，本owner仅接11个 `<reference-image photo-key="home-ROLE" photo-class="原class 几何class" />`。根组件virtualHost/shared/externalClasses接口经过其实际小原型验证；本owner的80项静态核查证明11个runtime JPEG与原URL响应整字节相等、所有key只消费一次。hot/idea/collage增加明确几何类，brand保留ribbon-image，源码/最小11节点CSS增量与root JSON两注册key记入photo-pack-integration.json。新JPEG未复制进main；不压缩、不重编码、不降低像素。根报告的12图getImageInfo/外部48px-r16/unknown key清空是组件原型边界，完整本页native仍由根验。

11 消费者和 source/response/current-src/尺寸逐项在 `photo-consumer-manifest.json`：brand-party；hot-tennis/coffee/frisbee/boardgame；idea-badminton/coffee/cycling；collage-main/dinner/grass，全部以 `w73-photo-` 作前缀。

5 SVG合计1,026 B：refresh14/blue、gray-chevron14/normal+hover、purple-chevron16/2.5、plus20/2.5。`inline-svg-manifest.json` 记录原 SVG 完整节点、child attrs/path、源行、原 SHA、颜色、runtime SHA；仅根 class/sizing、viewbox 拼写、xmlns/currentColor 做必要转换。没有 Material 替代，没有重画路径。

## 字体边界

普通长页 source sans 为 native SF/PingFang/Hiragino 栈。原 hand 栈为 Caveat → Permanent Marker → cursive → sans-serif；HTML 只声明 Caveat600/700 和 Permanent Marker400。完整 source 六个 hand 消费者中，旧 core 两个700全保护；本长页 brand/list/collage 请求700，city 原无 font-bold、继承400。CSS保持此原请求，root单独核准确 face 匹配与字形扩充，未擅自改 city 为700或加入全局字体。

## 根限定运行选择器与真实前置

普通状态 `activeTab='attending'`、`stateView=false`（原默认）；其他 tab 不应有新增长页样式。`homePreviewItems` 必须来自当前身份真实活动，空时只测试原空态，不能塞附近假活动。

| 入口 | 既有方法 |
| --- | --- |
| `.home-recommended-section .section-link` / `.home-idea-banner` / `.home-idea-list button:first-of-type` / `.home-final-cta button` | `goCreate` |
| 推荐2、热门4、主题4、构思后2、拼贴3 | `openInspiration`；原 data-title 值保持，非羽毛球仍真实闭态 |
| `.home-hot-section .home-long-head button` / `.home-collage-section .home-long-head button` | `goDiscover` |
| `.home-personal-section .home-long-head button` / `.home-personal-card` | `goItinerary` / 带真实 `item.id` 的 `openEvent` |
| `.home-trust-section .home-long-head button` / 第一说明卡 | `goAbout` |
| 第二说明卡 | `goGuidelines` |
| `.home-city-banner button` | `goCity` |
| `.home-long-footer .home-foot-links button` | `goAbout` / `goPrivacy` / `goSupport` |



## 检查、源差异增量与最终冻结

- 首轮唯一 checker80/80：完整WXML两chunk inverse回38,653 B / `b972b559a2c523f2b1c7ca794023595fe6fee94a90add1527a3ef1cce7204c81`；旧86,165 B CSS prefix回 `27b11080f2eb16d8a2280567b697a3edd0d7af3e4158bc341d7a44146dcd0cea`；JS整字节相等。root JSON仅usingComponents/componentPlaceholder新增且原四key保持，整例外逆回143 B baseline。所有旧动态字段/data/事件/条件契约相等；SVG原child/paint相等、14响应/11新runtime/3旧runtime整字节相等；直接image静态资源均存在，WXML结构通过。
- 首检后独审一次汇总三处明确源差异：4热门固定框；源transition的准确property-list/150ms/cubic-bezier；collage filter而非text-shadow。owner核原370/379/388/397、593和generated style-2后，仅4个框+7个CSS rule+1追加rule修复。19项增量证明整WXML逆回43,603 B、整CSS逆回107,076 B的已通过输入。没有重跑80、业务或历史套件。
- 增量首18/19通过，第19项比较 `.4` 与源 `0.4` 字面拼法产生harness误报，保留source-review-delta-proof-initial-failed.json；正确做等值十进制规范后只重核该断言通过，产品未因此修改。最后19/19；source-review-delta.json/proof说明完整最小逆除。
- 全部准确source来源及最终产品hash见同名JSON，root共享font/location不纳入本owner保护或包门主张。

| Owner 产品路径 | 字节 / SHA-256 |
| --- | --- |
| `miniprogram/pages/index/index.wxml` | 43747 / `9c35f217aefeaebfb33a003b996f127de9850e486ee431704d6480f816249f4e` |
| `miniprogram/pages/index/index.wxss` | 110058 / `9c370a6b694c57ee508e8c6c8a698094a1892c91d45e8b7f73a2b4244e8c9d87` |
| `miniprogram/pages/index/assets/w73-chevron-gray-hover.svg` | 185 / `b67239d32edd6382c1070e026501b0c4e28c10c17c0bce82aea0826985075634` |
| `miniprogram/pages/index/assets/w73-chevron-gray.svg` | 185 / `17dce00d9bce7f9ab6d95af53a15a823b8d52dc9207a11f21b672449c73ed7d8` |
| `miniprogram/pages/index/assets/w73-chevron-purple.svg` | 187 / `3c7658a5751fda953ea81b6c37b26cd326a792fafaf94c40de92b0808586b5f8` |
| `miniprogram/pages/index/assets/w73-plus-white.svg` | 189 / `b32b35e119356e82d38ab2e542aa06668cb9b5e5fcd67ef26cb5d585a2057c21` |
| `miniprogram/pages/index/assets/w73-refresh-blue.svg` | 280 / `5c3156e0797781eeb3895931da1308423de0adf27f872f17ea9cf4d866d153e8` |

Owner7个产品path源净增 **30013 B**（WXML+5094，WXSS+23893，5SVG=1026）。11 JPEG683581B、组件、JSON注册、全局字体属于root独占产品；不得把此source净增当最终包体实测。产品已冻结，独审只复核3项增量与接图；native/CLI/Git由根执行。
