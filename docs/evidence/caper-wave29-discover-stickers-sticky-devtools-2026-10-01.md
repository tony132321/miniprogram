# CAPER 发现页字贴与分类吸附定向复核（2026-10-01）

参照 `stitch_design_system_generator (2).zip` 中 `caper_4/screen.png` 和 `code.html`，调整四张摄影灵感卡的字贴换行与颜色层级；向下滚动时保留分类栏，并让品牌栏随内容离开。微信小程序原生右上角胶囊占据状态栏下方约 92rpx，因此分类栏吸附在该区域下方，避免盖住分类按钮。

将当前完整 `miniprogram/` 通过 `rsync -a --delete --exclude=config.js --exclude=.DS_Store` 同步到 `/private/tmp/caper-r1-e2e-20260930/miniprogram-project/miniprogram/`；排除这两项后的 `diff -qr` 退出码为 0。隔离项目使用测试 AppID `wxbbcab69099026d3f`、本地合成 API、微信开发者工具 CLI 端口 `21467` 与自动化端口 `9495`。`cli preview` 退出码 0，总包 **2,141,157 Byte**。

| 定向检查 | 模拟器读数 | 画面 |
| --- | --- | --- |
| 四卡首屏 | `personalState=READY`；四卡字贴分别为 `CITY/WALK` + `TOGETHER`、`BASKETBALL` + `NEVER/ALONE`、`GOOD COFFEE` + `BETTER/PEOPLE`、`BOARD GAME` + `GOOD TIMES`；分类 `top=103`、四卡网格 `top=148`。 | [发现页字贴首屏](images/caper-wave29-discover-stickers-top-2026-10-01.png) |
| 向下滚动 650px | 品牌栏 `top=-596`，分类栏仍为 `top=103`；分类栏没有与原生胶囊重叠，上方白色遮挡层未透出滚动内容。 | [分类栏吸附](images/caper-wave29-discover-category-sticky-2026-10-01.png) |
| 消息页图库旁证 | 在包含本轮消息图库尺寸调整的同一完整小程序副本中，模拟器实际显示四个灵感图块，横向可滚动，标题和“灵感示意”位于色块下方。 | [消息图库](images/caper-wave29-messages-gallery-sized-2026-10-01.png) |

自动化脚本 `/private/tmp/project-irl-automator/caper-wave29-discover-sticky-gallery-20261001.cjs` 捕获小程序 `exception` **0**。发现页相关测试 **11/11**、`tsc --noEmit`、`node --check`、`git diff --check` 均通过；未运行全量测试。截图是测试 AppID 的模拟器证据，并非真机、正式域名或公开活动验收。灵感卡仍明确标识“仅供构思 · 暂不可报名”，没有虚构公开活动时间、场地或参与者。
