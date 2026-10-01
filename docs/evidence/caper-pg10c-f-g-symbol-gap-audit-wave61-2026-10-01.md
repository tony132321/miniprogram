# PG10-C / F / G 原稿 Material Symbols 差距审计 · Wave 61

日期：2026-10-01。审计开始时 HEAD：`c567ed095a3baed0432dd250c27f06e5b2a935e8`。Wave60 的其他页面正在并行整合，本报告仅核对当前 moments、cache、support 三页，不修改产品、测试、共享矩阵或计划，也没有提交、运行测试、操作模拟器或下载字体/图标。

## 输入与判断口径

- 原稿：`/Users/tsb/Downloads/stitch_design_system_generator (2).zip`，只解压 `stitch_design_system_generator/pg10_{c,f,g}/code.html` 和 `screen.png` 六个文件，缓存于 `/private/tmp/irl-ui61-symbol-audit/pg10_{c,f,g}/`。三张原 PNG 均已查看；尺寸依次为 482×1600、780×1600、524×1600。
- 下表的行号属于相应原 HTML；色值来自该 HTML 的 Tailwind 配置和最近的文本色祖先，尺寸为符号的 `text-[Npx]`，不是圆形/方形容器尺寸。`F0/F1` 指 `FILL=0/1`。无内联 FILL 的原符号为默认 F0；脚本改变的状态单独列出。
- 原 HTML 的 Material Symbols 字体族是 **Outlined**。现有 SVG 全是自行绘制的 stroke/path，不能因名称近似就判定为官方原符号；CSS 人像、机器人、设备、盾形也不等同于原字形。
- 375px 页面宽度时 `1px=2rpx`；WXML 图片应使用明确 `width/height` 和 `mode="aspectFit"`。微信状态栏与原生胶囊避让继续由既有 `statusBarHeight/headerPaddingRight` 控制。
- 原 PNG 中 PG10-F 的诊断圆和已勾选圆未显示 HTML 指定的符号；这份审计仍记录 HTML 明确的 `auto_awesome`、`check`，不把截图缺字转成近似绘图或虚构功能。其他 HTML/PNG 不一致也不能据此宣称逐像素通过。

| 原稿 | HTML SHA-256 | PNG SHA-256 |
| --- | --- | --- |
| PG10-C | `cdf5a961530cf79b5678b45cef5dfb2347e6f5c0de442b871f5c6aba5bb49d5e` | `836659cfbca0fac930e6bdef69955d9485aa752f361098e3a667c1444ad4352b` |
| PG10-F | `a12aad1fa96051ccaddc5bc5f29e8e0f009b7dc8b7bfd89e8bc98e987cd834d8` | `01d7b4bd60552f39192f13dc592f60e43541fca25c9896ede9200662f9967a3f` |
| PG10-G | `879f14d2f1b296e89d9ddf7fbef3772c04d57f69493945d28ae3b293a4c1cf8d` | `cb899219ec6d51f3462bd9ecf7b531ece4c155ba55bfd486fdb94f4e125037a5` |

## 三页共用的原稿头部符号

每页 HTML 第10行都包含以下三个符号；它们计入下文每页的符号清单。按钮目标继续分别为 `back`、`toggleMore`、`goProfile`。

| 原符号 / FILL / 尺寸 / 色值 | PG10-C 当前位置 | PG10-F 当前位置 | PG10-G 当前位置 | 必要差距 |
| --- | --- | --- | --- | --- |
| `arrow_back_ios_new` / F0 / 24px / `#1a1b1f` | `.moments-header .pg10-back` 字符 `‹` | `.storage-back` 字符 `‹` | `.support-back` 字符 `‹` | 三页均应替换为本页本地 SVG、48rpx方框；当前继承 `#171a24`。原返回触区44px，当前 shared `.pg10-back` 宽74rpx=37px；本页覆盖为88rpx，不改共用文件。 |
| `more_horiz` / F0 / 22px / `#1a1b1f` | `.moments-header-more` 字符 `···` | `.storage-header .profile-header-more` 字符 `···` | `.support-header .pg10-header-more` 字符 `···` | 现字体32rpx=16px、字形与间距不同；触区已有88rpx，内部改44rpx官方图标。 |
| `person` / F0 / 18px / `#ffffff` | `.profile-glyph` 两个伪元素 | `.storage-person-icon` 两个伪元素 | `.support-person-icon` `/assets/stitch/pg10g/person.svg` 手画轮廓 | 内部36rpx官方图标；圆容器已有64rpx=32px。原圆底 `primary=#004cc8`，现为 `#064dca`，属于同处可收敛的色差。 |

源返回 span 额外有 `font-semibold`，PG10-F `check` 有 `font-bold`；固定 helper 的 provenance 声明 wght400/GRAD0/opsz24。本审计没有取得浏览器最终字体轴，不能把固定400输出进一步描述为已经验证原 Web Font 所有轴值一致。外观实现可沿用 Wave60 的核定管线，声明其固定轴边界。

## PG10-C moments

源中有23个 Material span、16个不同名称（含上述头部3个）；脚本还切换筛选 FILL 和点赞状态。当前页面12个 SVG 均为手画，不存在官方来源 manifest。

| 原 HTML 行 / 名称 | 原 FILL / px / 色值 | 当前位置或近似资源 | 必要替换或关闭状态边界 |
| --- | --- | --- | --- |
| 14 `auto_awesome` | 初始 F1 / 16 / `#ffffff`；失选 F0 / 16 / `#424655` | `.moments-filter-icon`，`sparkles-white.svg`、`sparkles.svg` | 两个官方版本分别为 F1白、F0灰；当前白图仍是空心 stroke。保持 `filters[all]` 路径结构即可，不必改筛选逻辑。 |
| 18 `groups` | 初始 F0 / 16 / `#424655`；选中 F1 / 16 / `#ffffff` | `groups.svg`、`groups-white.svg` | 必须使用复数 `groups`，不能用 `group`；白版必须 F1。当前仅画两个人的近似轮廓。 |
| 22 `crown` | 初始 F0 / 16 / `#424655`；选中 F1 / 16 / `#ffffff` | `crown.svg`、`crown-white.svg` | 两种 FILL均保留原名称，白版不是仅把 stroke改白。 |
| 26 `camera_roll` | 初始 F0 / 16 / `#424655`；源选中 F1白 | `.disabled-filter` 的 `film.svg` | 当前胶片框不等于 `camera_roll`；只需关闭态F0，继续 `胶片合影 · 待开放`，不新增第四种可用筛选。 |
| 37 `photo_camera_front` | F0 / 22 / `#1d64f2` | `.summary-icon image`，`front-camera-blue.svg` | 替换官方前置相机；44rpx尺寸现已匹配，原白圆40px也已匹配。 |
| 52 `favorite` | F1 / 14 / `#ff2d55` | 原回忆率胶囊目前只有 `.summary-state` 的“照片待开放”，没有图标 | 可在当前关闭标签前恢复28rpx官方装饰图形，仍不显示原98.6%、12/128/356等虚构指标。与footer的灰心不是同一来源/状态。 |
| 78、223 `cloud_download` | F0 / 14 / `#1d64f2` | `.pack-icon`，`download-blue.svg` | 当前是普通托盘向下箭头，缺云形；替换官方 `cloud_download`。继续 `打包待开放` 静态view，没有点击清单/下载行为。 |
| 88 `sports_tennis` | F0 / 14 / `#d2f803` | 原羽毛球照片badge；现 `.photo-overlay` 仅示意/未开放文字 | 源原图形缺失。若补可只在 `.moment-card.badminton .photo-overlay` 加28rpx装饰图形；仍使用“示意配图”，不得声称真实赛点或真人活动照片。 |
| 92 `favorite_border`；167、174 同名 | F0 / 18、16 / `#1a1b1f`；源点赞后 `favorite` F1 / 同尺寸 / `#ff2d55` | 当前没有照片点赞按钮；`.moment-footer-mark` 的 `heart.svg` 是18px、`#424655`空心手画心 | 原照片交互继续关闭。灰色footer为额外关闭说明，其图形可用官方 F0心轮廓替换，但不得把它误报成源14px粉色F1回忆率或已开放点赞。精确使用 `favorite_border` 需来源验证，不静默改名。 |
| 128、196、255 `share` | F0 / 18 / `#424655`；源hover蓝 | 当前没有相册分享，footer实际按钮为 `openActivity` | 源相册分享符号/动作不存在于关闭版；不新增相册分享、上传者或人数。不能以 `ios_share` 替代原 `share` 并宣称匹配。 |
| 131、199、258 `mode_comment` | F0 / 18 / `#424655`；源hover粉 | 当前没有相册评论，只展示关闭说明 | 源评论图形/数值/动作继续关闭，不添加14/29/8条评论假数据；若未来开放必须用原名称验证。 |
| 268 `face_retouching_natural` | F0 / 22 / `#5856d6` | `.privacy-icon image`，`face.svg`，当前 `#424655`通用笑脸 | 替换22px紫色官方图形，修复名称、路径与颜色。保留“尚未开放”“不采集或比对人脸”；不恢复绿色在线点/开启找我。 |
| 285 `photo_camera` | F0 / 20 / `#ffffff` | `.moments-action-icon`，`camera-white.svg` | 替换官方相机；40rpx已匹配。保持当前 `goCreate` 和 `发起新活动`/照片上传待开放，不启用上传。 |

原卡片类型图形 `🏸 / 🧺 / 🎲` 为原 HTML 的 emoji，不是 Material Symbols。当前 `.moment-symbol` 按示意类型采用相同emoji，无需用另一枚官方体育图标替换。源头像组L/K/J等是静态原稿展示，不能当作真实活动成员补回。

必要文件计划：`moments.wxml`、`moments.wxss`；现有 `moments/assets/` 的12个SVG用官方资源原位替换，添加本页 `arrow-back.svg`、`more.svg`、`person.svg` 和 `material-symbols-sources.json`。可直接延用现有SVG文件名，并在manifest写准确原符号名，避免触碰 `moments.js`。补原 summary粉心或羽毛球badge须使用独立明确名称，如 `favorite-pink-fill1.svg`、`sports-tennis-lime.svg`；保持关闭文字和真实卡来源。删除 `.profile-glyph::before/after` 后用36rpx图片居中，补本页返回/更多内部图标selector，不改 shared `common.wxss/navigation.js`。

## PG10-F cache

源中15个 Material span、14个不同名称（含头部3个）。当前没有本页官方SVG，正文使用CSS几何替代，且原清理内容已调整为真实设备读取说明。

| 原 HTML 行 / 名称 | 原 FILL / px / 色值 | 当前selector / 图形 | 必要替换或关闭状态边界 |
| --- | --- | --- | --- |
| 19 `storage` | F0 / 18 / `#1d64f2` | `.storage-stack-icon`，32×28rpx外加边框、两条横线 | 改36rpx官方storage，保留64rpx=32px蓝软圆；原字形含盘位细节，横线盒不是原图形。 |
| 69 `auto_awesome` | F1 / 22 / `#5856d6` | `.storage-device-icon`，24×38rpx手机轮廓；容器当前蓝色 | 源为填充紫色星芒，当前名称/轮廓/色均不同；可改44rpx官方星芒，现“设备存储状态/本机数据”照实保留，不引入AI诊断或近7天过滤承诺。 |
| 88 `photo_library` | F0 / 22 / `#1d64f2` | `.storage-session-icon` 手画证件框 | 原40px蓝圆角容器已有80rpx；内部换44rpx官方图库。保留当前本地数据说明，不编造8.6MB/142封面。 |
| 113 `forum` | F0 / 22 / `#5856d6` | `.storage-document-icon` 手画单页文件 | 原40px紫圆角容器已有80rpx；内部换44rpx官方forum，原双气泡不能用单页/`chat`替代。真实账号/活动说明及 `goPrivacy` 保留。 |
| 106、131 `check` | F0 / 16 / `#ffffff`，有 `font-bold`；随checked显隐 | 当前没有清理选择框 | 不新增全选或勾选清理分类；不能因原稿SVG可取得就恢复不安全的一键清理。 |
| 138 `verified_user` | F0 / 20 / `#34c759` | `.storage-shield-icon` 无勾盾形；当前 `#2fbf66` | 换40rpx官方带勾盾与准确绿色。关闭说明照实保留，不恢复“清理绝不丢失”保证。 |
| 146 `cleaning_services` | F0 / 20 / `#ffffff` | `.storage-refresh-icon` CSS重读箭头 | 与原图形不同。若恢复原装饰扫帚图形用40rpx官方资源，但按钮仍只绑定 `refreshStorage`、标签仍“重新读取设备存储”；符号替换不能附带新增清理。 |
| 150 `check_circle` | F0 / 14 / `#737687` | `.storage-read-status` 字符 `◷`，READY显示实际最近读取时间 | 可用28rpx官方check_circle替换字符；保持真实 `lastReadAt` 和 READY条件，失败说明独立，不恢复原2024清理时间/“设备运行顺畅”。 |
| 159 `delete_sweep` | F1 / 30 / `#ff2d55` | 原清理确认sheet，当前完全没有 | 原功能关闭，sheet与符号继续不存在，不增加清除动作。 |
| 169 `delete_forever` | F0 / 18 / `#ffffff` | 原立即清理按钮，当前没有 | 与上行相同；不得复原按钮行为。 |
| 180 `task_alt` | F1 / 18 / `#34c759` | 原清理成功toast，当前没有 | 没有清理成功状态，不恢复释放12.4MB等toast。 |

必要文件计划：`cache.wxml`、`cache.wxss`，新增独占 `cache/assets/` 与manifest；头部3枚、正文 `storage/auto_awesome/photo_library/forum/verified_user` 5枚是直接替换，CTA及READY读数说明按上表补精确原glyph。删除被替换的 `.storage-person-icon/.storage-stack-icon/.storage-device-icon/.storage-session-icon/.storage-document-icon/.storage-shield-icon/.storage-refresh-icon` 伪元素几何，保留外层容器和已匹配尺寸。`cache.js`无需修改；数值、百分比和时间继续由 `wx.getStorageInfoSync` 派生，失败仍是 `--`，没有清空存储。

## PG10-G support

源中21个 Material span（含脚本template）、17个不同字面span名称；另有toast脚本动态赋值 `error/info`，故完整名称集合为19个（含头部3个）。当前8个 `/assets/stitch/pg10g/*.svg` 全为手画，机器人和FAQ箭头为CSS/字符。

| 原 HTML 行 / 名称 | 原 FILL / px / 色值 | 当前selector / 资源 | 必要替换或关闭状态边界 |
| --- | --- | --- | --- |
| 19 `smart_toy` | F1 / 26 / `#ffffff` | `.assistant-face/.assistant-eyes/.assistant-mouth` 手画机器人 | 替换52rpx官方填充机器人，外圆96rpx=48px已匹配；删除脸/天线/眼嘴的CSS图形。继续暂未开放，不补绿色在线点或3秒响应。 |
| 35 `chat` | F0 / 18 / `#ffffff` | `.support-ai-action .support-action-icon`，`chat.svg` | 换官方18pxchat，当前自行绘制带文字气泡；按钮继续disabled。 |
| 39 `support_agent` | F0 / 18 / `#5856d6` | `.support-human-action .support-action-icon`，`agent.svg`，当前 `#5754d7` | 换原带人物的客服图形；当前近似耳机缺原结构且色差。按钮继续disabled。 |
| 48 `help_center` | F0 / 20 / `#1d64f2` | `.support-section-icon`，`help.svg`，当前 `#2465ef` | 换40rpx官方help_center，不使用通用help或自己画问号框。 |
| 58、70、82、94 `expand_more` | F0 / 20 / `#737687`；展开旋转180° | `.support-faq-chevron` 字符 `⌄`，字体31rpx=15.5px、`#7b8495` | 换40rpx官方图片，沿用 `.is-open`旋转与 `toggleFaq`，保留四个真实FAQ答复。 |
| 108 `edit_note` | F0 / 20 / `#5856d6` | `.support-edit-icon`，`edit.svg`，当前 `#5754d7` | 换官方20pxedit_note；不是 `edit` 图标，当前手画横线/笔并非原路径。 |
| 153 `add_photo_alternate` | F0 / 26 / `#737687` | `.support-upload-icon`，`photo.svg`，当前 `#8a91a1` | 52rpx已匹配，换准确原glyph与色；静态“图片未开放”继续，不新增文件选择或图片凭证。 |
| 163 `contact_phone` | F0 / 20 / `#737687` | `.support-contact-icon`，`contact.svg`，当前 `#8a91a1` | 40rpx已匹配，原contact_phone不是通用通讯录；输入保持disabled且不收集联系方式。 |
| 170、349 `send` | F0 / 20 / `#ffffff` | `.support-send-icon`，`send.svg` | 40rpx已匹配，替换官方原路径。反馈提交继续disabled，无发送/假成功。349为脚本提交结束恢复template。 |
| 178 `schedule` | F1 / 16 / `#34c759` | 原工作时间栏；当前仅 `.support-footer` 的未公布说明 | 服务时间未公布，不复原09:00—22:00。若在关闭说明旁恢复装饰图标需F1，缓存现存 `schedule_24px.svg`是F0，不能冒充该版本。 |
| 182 `chat_bubble` | F0 / 16 / `#5856d6` | 原客服微信栏；当前无真实客服信息 | 不恢复原静态 `IRL_Support_Team`。不能用已有 `chat.svg`替代另一个glyph；未公布信息继续真实。 |
| 189、316 `check_circle` | F0 / 18 / `#34c759` | 原反馈成功toast；当前没有 | 反馈发送未开放，不新增成功toast。 |
| 310 `error` | F0 / 18 / `#ff2d55` | 原脚本showToast错误状态；当前没有 | 非当前提交功能状态，继续不添加。 |
| 313 `info` | F0 / 18 / `#1d64f2` | 原脚本showToast信息状态；当前没有 | 同上。 |
| 277 `close` | F0 / 14 / `#ffffff` | 原用户上传图片删除按钮的template；当前没有上传预览 | 不新增图片上传/删除交互。 |
| 341 `progress_activity` | F0 / 20 / `#ffffff`；animate-spin | 原发送中template；当前没有 | 不制造发送中状态或1秒后成功。 |

当前额外 `.support-safety-icon` 的字符 `!` 及举报按钮属于真实安全求助适配，原 PG10-G没有对应Material符号；不能把它记录为源图标恢复。若后续同时收敛该字符，可使用Wave60已核定的 `report_problem`独立官方字体来源，但须明确是安全适配，而非原PG10-G图标。

必要文件计划：`support.wxml`、`support.wxss`；推荐在本页新增 `support/assets/` 与manifest，放头部3枚、smart_toy、expand_more及现8个手画SVG的官方替代，把WXML src改为本页路径。也可原位替换既有8个资源并在其目录补manifest；已确认这些8个资源的使用入口为support页面。页内图标全部明确36/40/44/48/52rpx对应原尺寸，移除被替换的机器人CSS几何和FAQ字体定义。原8个文件是否清理由整合者按实际引用决定。`support.js`不需修改；FAQ/发起/举报/关于/我的路由及disabled属性保留。

## 官方资源管线与下一批边界

已有 helper：`/private/tmp/irl-material-symbols-wave60/export_symbol.py`。已核定仓库 `https://github.com/google/material-design-icons` 的提交 `bd8cb85bd4bad964fe6918f79665bb40c3a8efef`；helper读取相应 `symbols/web/<name>/materialsymbolsoutlined/<name>[_fill1]_24px.svg`，只修改SVG根fill，保留官方glyph路径，并记录source URL、源/资源SHA-256、symbol/FILL/color和固定轴。Apache-2.0文档已在 `docs/licenses/material-symbols-Apache-2.0.txt`。

- 本审计只检查了现有本地helper/cache/provenance，没有运行helper或下载补缺文件。本地已有 `arrow_back_ios_new/more_horiz/person/auto_awesome(F0,F1)/chat/check/check_circle/close/delete_forever/photo_camera/schedule(F0)/sports_tennis(F0,F1)/verified_user` 等原始缓存；未缓存不能推断上游404，也不能推断存在。
- `groups`不能用缓存`group`，`cloud_download`不能用`download`，`edit_note`不能用`edit`，`share`不能用`ios_share`，`favorite_border`不能无证明改为`favorite`。其余未缓存原名仍需按准确名称取得和核对。
- 若某原名在固定SVG提交无文件，应沿Wave60的 `docs/design-sources/material-symbols-report-problem/` 模式取得**该原连字**的官方静态子集，保存字体版本、CSS/字体来源、hash、GSUB glyph映射和未经描形修改的路径证明；不能改为语义相近的图标，也不能把字体来源归入固定SVG commit。
- 需要新FILL版本的 active groups/crown、smart_toy、favorite粉心、schedule不能只给F0轮廓换白/绿/粉。显示尺寸改变SVG布局框，不重新画stroke。
- 本报告确认的是源码差距和替换范围；未运行定向测试、编译CLI、微信模拟器或真机。整合者应只按用户允许的本批相关检查与三页实点复核，核对SVG解析/实际本地引用、FILL与颜色、头部胶囊避让、筛选两态和FAQ旋转；不能提升为39屏逐像素或上线验收。

真实状态边界：moments只读 `/me/events`本人记录并保留会话隔离、照片示意、相册/点赞/评论/人脸未开放；cache只读微信本机统计和实际时间、不提供清除；support只提供当前FAQ/真实举报与导航、客服/反馈/上传保持关闭。官方图形替换不要求虚构原稿数据或启用未开放服务。
