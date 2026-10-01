# PG10-C／F／G 官方字形恢复计划

基线：本地 `5361bb6`，已完成 Wave 60 四页整合；远端上传同批 tree 由根代理独立推进。用户继续授权原稿复刻、复用代码、并发、每批 GitHub 上传；禁止全量测试。

## 全局约束

依据 `docs/evidence/caper-pg10c-f-g-symbol-gap-audit-wave61-2026-10-01.md` 和三个 ZIP 原 HTML／PNG，恢复准确 Material 名称、FILL、颜色、尺寸，保持所有真实 R1 行为和关闭状态。不改业务 JS、共享样式／导航、真实数据、API 或安全策略。各页面独占 WXML、WXSS、assets 与实现证据。375px 下 1px=2rpx，返回触区44px、原生头像32px；保留动态状态栏／胶囊避让，采用上一批局部安全区底色方案。

固定官方 SVG helper：`/private/tmp/irl-material-symbols-wave60/export_symbol.py SYMBOL ABS_ASSET --color '#xxxxxx' [--fill 1]`。必须保留原path及来源manifest。若准确名字实际404，使用同目录 `export_font_symbol.py` 同样参数，从原连字的官方静态字体提取；每名独占 `docs/design-sources/material-symbols-<name>-fillN/`，公开原字节及GSUB证明，不用相近图标替代。原字形回退独立于固定仓库版本。许可已保存，不复制或透露用户连接密钥。

只做必要官方图形／尺寸／颜色／本页顶栏变化，不重做 Wave 59 布局或照片。关闭功能的原稿成功、在线、上传、清理或合影交互不恢复；新图标不能引入虚假状态。实现者不操作共享模拟器、不提交、不跑全量，不为样式新增镜像测试。既有相关验证仅在变动实际绑定／静态资源断言风险时运行一次；不重复已通过的业务套件。根代理再独立核对源码、字形来源、相关实点与包体并上传。

## Task 1: PG10-C moments

只改 moments WXML／WXSS、其12个近似SVG及独占新增素材／manifest／证据。精确 groups/crown 双FILL、camera_roll、cloud_download、face_retouching_natural 紫色、photo_camera；favorite_border 原名如404须字形证明。恢复头部三官方图标，原28rpx粉心和羽球示意装饰可按审计添加但不恢复虚构照片率/成员/点赞/评论。原8张JPEG和照片来源manifest不动。filters paths／事件筛选／同ID深链保持 JS 不变。

## Task 2: PG10-F cache

只改 cache WXML／WXSS、新独占assets／证据。精确 storage、auto_awesome F1紫、photo_library、forum、verified_user、cleaning_services及check_circle读取时间装饰；头部三图标、准确色值。删除已替换CSS轮廓，外框与读数几何不改。refreshStorage仍只读取；数值／更新时间／失败状态／隐私路由不动，无清除选择框、确认sheet或成功toast。

## Task 3: PG10-G support

只改 support WXML／WXSS、独占assets／证据；原main包8个近似图形只有本页使用时可迁出并删除，必须先rg引用确认。精确 smart_toy F1、chat、support_agent、help_center、expand_more（保留open旋转）、edit_note、add_photo_alternate、contact_phone、send及头部三图标；可恢复未公布工作时间的schedule装饰，但不添加承诺。额外真实举报!可用Wave60已验证report_problem字形本页复制并按实际安全色改fill，manifest注明R1适配而非原稿图标。不启用客服、上传、反馈、联系方式，不新增假在线或响应时间。

## 整合与复核

三个新实现者并行，各自只读相同参考、写独占页和证据。根代理同时完成上一批GitHub上传，读取的是不可变 HEAD blobs，避免混入本批。所有者完成后新独立审查者逐项核对精确路径/FILL/hash/引用和关闭边界。根代理只执行C筛选/图形、F原生读数/刷新、G FAQ/图形/关闭按钮及必要导航，单人顺序用模拟器；final CLI／差异／凭证检查后提交skip ci并上传。全39屏逐像素与外部真实环境不据局部结果标完成。
