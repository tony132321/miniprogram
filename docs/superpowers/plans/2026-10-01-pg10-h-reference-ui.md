# PG10-H 四页原稿恢复计划

基线：本地 `8cdd564`／GitHub `0f4400b`，相同tree482aaf9。用户持续授权完整原稿复刻、复用业务、子代理并发、每批上传；不要全量测试。原设计输入为ZIP，不能把其在线、正式版本、100%出席、虚构依赖、主体或付款承诺当成事实。现有R1文案与绑定保留。

## 全局约束

四组原HTML/PNG位于 `/private/tmp/irl-ui62-reference/pg10_h_project_irl`、`pg10_h_1`、`pg10_h_2`、`pg10_h_3`；独立审计 `docs/evidence/caper-pg10h-reference-gap-audit-wave62-2026-10-01.md` 并行写入，准备好后完整读。各实现者必须自己完整读取原HTML并查看PNG，不靠审计代替。只修改本人WXML/WXSS和页面独占assets/来源manifest/证据；业务JS、shared导航/common.wxss/API/关闭策略不动。不凭UI加入功能。采用375px=750rpx原单位，恢复56px顶部、44px返回和share/more触区、32px头像/准确primary颜色，按source单页返回居中或靠左；保持实际胶囊+8px避让、sticky位于statusBarHeight、页内fixed状态底色且pointer-events:none。H1/H2/H3原16px页边而非现9px，所有卡片字号、间距、圆角、图形外框按HTML token恢复；现文字变化造成自然高度差异诚实记录，不强塞虚构原文。

精确Material图形用 `/private/tmp/irl-material-symbols-wave60/export_symbol.py SYMBOL ABS_ASSET --color '#xxxxxx' [--fill 1]`，fixed commit bd8cb85bd4bad964fe6918f79665bb40c3a8efef；准确名404才用 `export_font_symbol.py`，每名独占proof目录，font版本与pinned仓库分开。原path只改根fill，注明FILL/source/asset hash。相同名字缺失proof应先告知根代理防并发共享覆盖。每页独占assets。原Infinity Spark logo直接保留原SVG的gradient/path/defs和viewBox，不用Unicode/重画。许可已有Apache。未验证原Webfont所有最终轴或PlusJakarta，不声称逐像素100%。

原稿摄影若明确提供公共Google图片URL，可按实际原字节保存页面独占JPEG和source manifest、标为场景示意而非真实活动照片；不改原JPEG字节或用其他照片替代。若实际不可取得先报告，不擅自重画。

不写照搬样式镜像测试、不跑全量/业务套件/微信模拟器/提交。各自一次必要资源hash/XML/local refs/FILL核对、JS byte不变、scopeddiff即可。根代理独占CLI和模拟器，只对新改页面几何/图片及少量真实关键入口做定向复验；修复后只复验具体影响。最终差异/凭证/CLI通过，skip ci提交与GitHub相同tree上传。

## Task 1: About + Open-source

独占 `miniprogram/pages/about/about.wxml/.wxss/assets`、`miniprogram/subpackages/profile/open-source/open-source.wxml/.wxss/assets`，各自证据。About恢复原96px品牌盒、56px显示尺寸/64×64viewBox的确切Infinity SparkSVG、28px品牌名、源manifesto引用/心形、40px列表图标及正确官方图形和源渠道圆形/卡片/底部动作结构；实际未公布官方账号/本地候选/R1导航保持，更新检查fake成功不实现。H3恢复16px边/12px圆角卡、48pxcode图形、17px标题/13px正文、依赖许可11px标签、真实仓库复制/公开页share/菜单返回保持。真实已安装pg8.23.0 attribution若当前错写PostgreSQLGlobalDevelopmentGroup，按node_modules/pg/package.json + LICENSE实际作者修正，证据保留。原稿虚构依赖不替代实际列表；新Material图形的真实许可已存在，必要时准确补入展示而不冒称字体已加载。

## Task 2: H1 Release notes

独占 release-notes WXML/WXSS/assets及本页证据。恢复原16px边/16px圆角和padding、22/28pxhero标题、17/22px章节、13/18px正文、11pxchips，40pxfeature icons/24pxglyphs、144px原图示意照及source提供的原图；按原稿小点列/双列/三列结构恢复，尽量保持真实R1语义。准确ios_share、verified、event、auto_awesome、mic等原有角色图形，不以图形包装虚假AI语音/模型/正式更新/自动支付。原已接通说明及后续关闭清单、发起/本人活动两个入口和分享元数据仍保留，JS不动。

## Task 3: H2 Guidelines

独占 guidelines WXML/WXSS/assets及本页证据。恢复原16px边/16px圆角padding、64px握手hero/32pxF1握手、28px粉色角标/15pxF1favorite、22pxhero/15px正文、三列实际守时友善透明说明；40px章节外框/22px图形、17px标题/11px英文/13px规则/20px小点框及14px准确原符号。各规则小点列和分隔按原稿结构，保留真实当前规则措辞、举报入口及末尾正式公约未发布说明，不恢复100%出席、自动处罚或付款承诺。原glyph名称对应原位置可仅视觉装饰；实际规则语义不因此改写。JS/report当前会话保护不动。

## 整合和独立复核

3个fresh实现者：Task1两页同主绑定+依赖只读，Task2/H1和Task3/H2独立；各自selfcheck+三对共享scope审计，唯一共享资产proof若碰同名由根代理协调，只读pinned缓存允许共用。本地既有专用branch/隔离微信工程复用，不重建worktree。根代理在前批上传期间只读取不可变HEAD；新独立源码审查在实现交接后核对original/source/path/geometry/closedR1/真实依赖。定向模拟器新页面测header安全区、source图形大小/照片、一个关键可用按钮和必要返回，不重跑全项目。保持目标进行中，外部前提仍待资源。
