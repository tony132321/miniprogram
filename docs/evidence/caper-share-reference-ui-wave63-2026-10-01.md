# 活动邀请卡原稿 UI 恢复（Wave 63，2026-10-01）

Task 3 按已接受计划实施；本文件只报告页面源码、官方资源和单个既有 share 测试文件的本地证据。根代理负责之后的微信编译、当前页面截图、真实 160px 二维码解码、复制／弹层和不可分享态验收。本轮没有 Git、微信 CLI、Automator、SDK 或电脑界面操作，也没有全量测试。

## 来源与范围

已完整读取原 `_3/code.html`，并通过 `view_image` 查看 570×1600 的 `_3/screen.png`；依据 HTML 明确的 CSS token，在 375px 设计窗口以 2rpx=1px 实施。对应独立审计为 `docs/evidence/caper-share-reference-gap-audit-wave63-2026-10-01.md`，实施计划为 `docs/superpowers/plans/2026-10-01-city-itinerary-share-reference-ui.md`。源 HTML SHA-256 `dc13ab1a0889aefa66090c208839573e24f925a6969bc220ca86bc0dd4a9622b`；源 PNG SHA-256 `349d2b42e3da3c00e1654ad0ffcd37f6831dfc7b10e3969ad2b20b1641ec1779`。

产品写入仅为 `share.wxml`、`share.wxss`、`share.js`、本页新增 `assets/` 和既有 `test/miniprogram-caper-share.test.ts` 的单个码面尺寸断言。分享弹层原四枚 SVG、QR vendor、poster 测试和共享样式、后端、数据及验收总表未改。

## 本页恢复与真实事实边界

- 顶栏恢复 56px 行高、44px 返回触区／22px 精确 glyph、17/22px 标题、32px primary 蓝头像／18px person、16px 左边距。顶栏按原固定布局，WXML 使用既有真实 `statusBarHeight` 作为 top；上方非交互状态栏底色与页面的对应占位配合。右侧仍使用原 `headerPaddingRight()` 按原生胶囊边界加 8px 避让，JS 导航和胶囊计算没有改变。源 blur-xl 为 24px，写为 48rpx。真实客户端布局待根代理核实。
- 外层恢复 16px 横边距、16px 组间距、底部 32px 与安全区；引导恢复 8px 顶距、4px 子项间距、22/28px 主标题与 13/18px 说明。verified F0 15px 仅在真实 `canShare` 为 true 时出现。
- 白券恢复 radius16、8px 蓝／青柠／紫彩条、原 kicker 间距与 sports_tennis F1 20px。正文 padding16、gap12、20/26px／700 活动标题，真实状态使用源青柠 10×4px padding／r8／1° 贴纸。标题自然换行。
- 将已有真实已确认人数／最低成局人数置于原 capsule 层级，13/16px、10×4px padding、gap8；已确认 capsule 的点为 6px。没有主办 display 数据，因此源 account_circle／Luna 主办槽不创建、不下载、不渲染；第二枚胶囊仍明确表示真实最低成局人数。
- 事实盒恢复 padding14、gap10、r12、底 `#F5F6F8`，28px/r8 图盒、18px calendar_today/location_on、11/14px 标签及 15/20px 主值。日期和地址允许自然多行；地点仍是已有城市和“具体地点请在活动详情核对”的脱敏显示。
- 撕线恢复两侧 28px 圆形缺口、左右 -14px 偏移，divider 内居中；线为 2px 虚线、左右 margin20、`#c3c6d8` 40%。券自身 overflow-hidden 裁去圆形外半边；圆与线全部为不可操作的装饰。
- 真实 QR canvas 的内联尺寸改为 160×160px，独立白框 padding12px／r16，总 184×184px。框不裁切画布，码面无 padding、无 rounded 裁切、无 transform、无 IRL 覆盖或装饰 SVG。白框 padding／radius 使用 px 与固定 px canvas 同步，保持所选实际总框尺寸。
- 口令恢复整宽灰底 `#efedf3`、padding12、r12、gap8、18px key。动态 `display.inviteToken` 仍以原绑定完整展示，`min-width:0`、normal、overflow-wrap:anywhere、word-break:break-all 支持真实 32字符 base64url 邀请码换行（服务端生成依据为 `src/events.ts:302,342` 的 `randomBytes(24).toString('base64url')`）；没有加入空格或省略。主券复制按钮及弹层两个 `copyInvite` 共三处仍可达；弹层口令取消 ellipsis，按钮保持 flex:none，原四枚图形未动。
- 三张真实说明卡恢复 padding14/r12/gap12、36px 圆图盒、20px bolt/groups_2/receipt_long（均 F1）、17/22px 标题和 13/18px 副说明；卡中文字容器 flex:1/min-width:0，无固定高度或单行裁切。保留当前状态、报名、费用／取消的准确说明。
- photo_camera F0 16px 只装饰“在分享选项生成并预览海报”的准确操作提示。保留分享 CTA、反馈、已有原生分享和本地生成海报流程；没有恢复原稿的免审核、自动成局、预订场馆、固定差人数或已经生成海报的样例承诺。

## 最小 JS 与测试变更

从实施前快照逐字比较，`share.js` 只变更以下一处：

```diff
-  paintInviteQr(token, context, 0, 0, 200);
+  paintInviteQr(token, context, 0, 0, 160);
```

`paintInviteQr()`、M 级、`size/(count+8)`、四模块 quiet zone、floor/ceil 光栅算法保持原字节；poster 仍在 `(80,279)` 绘制 200px QR，离屏画布仍 360×600px。资格、服务端有效期、报名截止、身份、账号切换、onHide/onUnload、页面／请求／海报版本和复制最终重新核对逻辑全部保持原字节。

既有 share 测试唯一改动是白底边界 `[0,0,200,200]`→`[0,0,160,160]`；未加样式／布局镜像测试，未改 poster 测试。

## 本地验证

必要资源自检通过：11 枚 SVG 均可 XML 解析，精确原名、FILL、颜色、固定源 URL、源和成品 SHA-256 与 manifest 匹配；去掉根 fill 后每枚源／成品 XML 一致。WXML 经通用 XML 检查（仅为检查器规范化既有 boolean wx:else 和 logical &&），17 处本地引用对应 15 个现存资源；三处 copyInvite 与两处实际 token 展示保留。初次 generic XML 检查不识别既有 boolean `wx:else`，适配检查器后通过，产品不因此变更。

官方资源来自固定提交 `bd8cb85bd4bad964fe6918f79665bb40c3a8efef`，Outlined / wght400 / GRAD0 / opsz24。11 项导出全部成功，无新增 404；仅 SVG 根 fill 改色，没有写入共享 fallback proof 或分发字体。源网页最终字体轴与 Plus Jakarta Sans 字体外观尚未测量，不能声称逐像素字体等同。

单次完成的窄测试命令：

```text
/Users/tsb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --import tsx --test --test-isolation=none --test-concurrency=1 test/miniprogram-caper-share.test.ts
```

exit 0，**32 tests / 32 pass / 0 fail / 0 skipped**，561.636708ms。该文件中的既有“approved invitation card draws a QR containing only the current private invite token”实际运行，通过当前／轮换 token 传入、inviteQr 画布、160×160 白底和不合资格后停止绘图的断言。该测试使用 QR stub，**不证明真实码解码成功**。初次尝试裸 `node` 在 shell PATH 中不存在，未执行测试；使用桌面依赖工具返回的 bundled Node 后上述单个文件运行成功。未运行全量测试或其余测试文件。

## 冻结交接哈希

| 产品文件 | SHA-256 |
|---|---|
| `miniprogram/subpackages/activity/share/share.wxml` | `fa6664d9fc3a697509fee78362a4dbec909b6051cc7a6656655622a6f1560af5` |
| `miniprogram/subpackages/activity/share/share.wxss` | `8309549f016b13b98e2496551089e88a069265c6d0b60b2ac8bb5a3b562f196c` |
| `miniprogram/subpackages/activity/share/share.js` | `5fdde14c88902bb18e4c045d81326974978d718c6181d94cf76c86f2177a8258` |
| `test/miniprogram-caper-share.test.ts` | `cf169bd68140596dc1a2cb996c4ba07eb288180efa4f93a3d21d2eabeb7ebe1c` |

11 枚新 SVG 共 5015 bytes；manifest 记录每个精确源名、FILL、色值、源 URL、源和成品散列。

| 本页新资源 | Bytes | SHA-256 |
|---|---:|---|
| `arrow_back_ios_new.svg` | 173 | `b4d72b3ef91399480f63d49489df5b8ff1b26436974b423b3c60d11b103ff854` |
| `bolt_fill1.svg` | 174 | `0f8fb065eac81e0e5f8966c043af0fabb27655962804f6f0c962298cf93310bc` |
| `calendar_today.svg` | 321 | `963b2f6ca1ab6a31bffaaac553a98b6225174aee78bf84cd9ad380e0b6f4b9f7` |
| `groups_2_fill1.svg` | 871 | `45af03ce9c37e4846994c671a3e7a075de4d2b46d62d54568a521b9965c711fb` |
| `key.svg` | 486 | `34b24d7ea802b1df0fc1ab75b1a740dda2feade1df04c1a69a2464690a2b5476` |
| `location_on.svg` | 441 | `05727ad0db599d66076ba4c932c331ac01bc8fe210ae7ced01c518358e4875f2` |
| `material-symbols-sources.json` | 6216 | `8151f2fd7f932ab68cbe338593212013c24f3867b00c32f36b402116831691c0` |
| `person.svg` | 544 | `d66a89fc9036f18a31f3804ee7b19f52a7954e31cc1cbfbd9b98f206a8299d6f` |
| `photo_camera.svg` | 496 | `8723335ab2f54be0a1133493e0f8021e27fc973e75b697f196f8f32f000b041f` |
| `receipt_long_fill1.svg` | 571 | `163d0a4e71a5ce963551379d562b136dd75d7ae262459fa467a63c291c788c0f` |
| `sports_tennis_fill1.svg` | 469 | `7f676e890f604d2628dd3566031dcf1780b3e962b87f105d81d20add46c0f4fa` |
| `verified.svg` | 469 | `41463c802953513d26fe683ca7e33b30162ce11de8ad674caf251862f503dd3b` |

| 已保留的文件 | 不变 SHA-256 |
|---|---|
| `miniprogram/vendor/qrcode.js` | `79ec86f82856005b1c887905cfccfcfbec3821ca61c7fd5a952faa5f778f791c` |
| `test/miniprogram-caper-poster.test.ts` | `b8ecbf4caf21b9cab5ceed77eab04f0fb6d136bdff0edeb32ae2704fb508040d` |
| `miniprogram/subpackages/activity/share/icons/chat.svg` | `9df8ad78893b44de1bf5c64bd90faf3c3fce64631091e5167119a2d358e8abe1` |
| `miniprogram/subpackages/activity/share/icons/copy.svg` | `1047a97a68f9bbf5ebec3e064a57662c7a60a9ddf01eee73dcfca001aee1e9e9` |
| `miniprogram/subpackages/activity/share/icons/group.svg` | `278a87bf96cc9c8e2613986978fb7f84df196a7b518b3306ac9fd329655cb8c0` |
| `miniprogram/subpackages/activity/share/icons/poster.svg` | `0868b6d957d133baa5d12a9c1871f18496d079c86b95477c3d750addbcef4bec` |

## 尚待根代理整合证据

本地源码／资源／既有测试范围已完成并冻结。尚未取得本轮微信编译、375px／当前客户端胶囊与完整换行几何、当前实际 eligible 32字符 base64url 邀请码 的 160px QR 截图与解码、主券／弹层复制实点、不可分享闭态、微信原生发送、真机和正式 HTTPS 链路的证据。根代理必须解码当前实际 screenshot 中的真实 160px QR；不可将这里的 stub 测试当作解码通过。源 570px 导出 PNG 不能替代本轮运行截图或生产验收。
