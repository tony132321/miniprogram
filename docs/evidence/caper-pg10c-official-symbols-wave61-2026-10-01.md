# PG10-C 官方字形恢复 · Wave 61

日期：2026-10-01。实现基线：`5361bb6`。参考原 HTML 与已查看的 482×1600 PNG：`/private/tmp/irl-ui61-symbol-audit/pg10_c/`；原稿 hashes 见 Wave61 差距审计。此记录只说明本页源码与素材验证，模拟器实点由根代理顺序执行。

## 本页恢复

12 个手画 SVG 已原位替换为准确名称的官方 Outlined 字形；新增头部3枚、原粉色 F1 心和羽球示意装饰2枚，共17枚。筛选仍绑定 JS 现有 `icon/activeIcon`，三种可用筛选的 F0灰/F1白均为分别导出的准确路径。camera_roll 保持关闭态 F0。头部箭头/更多/人物分别48/44/36rpx，返回触区88rpx（44px），头像容器64rpx，底色改为原 `#004cc8`。删除 CSS 人像伪元素；状态栏底色收敛到原 `#faf8fe`，保留动态高度和胶囊避让。所有图形明确 `mode="aspectFit"` 和宽高；照片 aspectFill 不动。

| 本地 SVG | 准确符号 | FILL | 色值 | 尺寸（375px宽） |
| --- | --- | --- | --- | --- |
| `arrow-back.svg` | `arrow_back_ios_new` | 0 | `#1a1b1f` | 24px / 48rpx |
| `camera-white.svg` | `photo_camera` | 0 | `#ffffff` | 20px / 40rpx |
| `crown-white.svg` | `crown` | 1 | `#ffffff` | 16px / 32rpx |
| `crown.svg` | `crown` | 0 | `#424655` | 16px / 32rpx |
| `download-blue.svg` | `cloud_download` | 0 | `#1d64f2` | 14px / 28rpx |
| `face.svg` | `face_retouching_natural` | 0 | `#5856d6` | 22px / 44rpx |
| `favorite-pink-fill1.svg` | `favorite` | 1 | `#ff2d55` | 14px / 28rpx |
| `film.svg` | `camera_roll` | 0 | `#424655` | 16px / 32rpx |
| `front-camera-blue.svg` | `photo_camera_front` | 0 | `#1d64f2` | 22px / 44rpx |
| `groups-white.svg` | `groups` | 1 | `#ffffff` | 16px / 32rpx |
| `groups.svg` | `groups` | 0 | `#424655` | 16px / 32rpx |
| `heart.svg` | `favorite_border` | 0 | `#424655` | 18px / 36rpx |
| `more.svg` | `more_horiz` | 0 | `#1a1b1f` | 22px / 44rpx |
| `person.svg` | `person` | 0 | `#ffffff` | 18px / 36rpx |
| `sparkles-white.svg` | `auto_awesome` | 1 | `#ffffff` | 16px / 32rpx |
| `sparkles.svg` | `auto_awesome` | 0 | `#424655` | 16px / 32rpx |
| `sports-tennis-lime.svg` | `sports_tennis` | 0 | `#d2f803` | 14px / 28rpx |

粉心仅装饰“照片待开放”，没有恢复虚构回忆率。sports_tennis 仅在羽毛球示意图标记出现；“示意配图/活动相册未开放”文字保持。footer favorite_border 是当前 R1 关闭说明装饰，使用18px灰色，不冒充原粉心或已开放点赞。share/mode_comment 与相册上传/下载/人脸找我交互继续不存在。相册成员、上传者和点赞评论数量未补入。

## 官方来源

16枚来自固定 Google `material-design-icons` commit `bd8cb85bd4bad964fe6918f79665bb40c3a8efef`，只改根 fill，保留全部子元素/官方 glyph 路径。逐资产 source URL、source SHA256、asset SHA256、FILL/颜色记录在本页 `assets/material-symbols-sources.json`。固定轴为 Outlined wght400/GRAD0/opsz24；未声称与原 Web Font 的所有最终轴值经过浏览器比对。

`favorite_border` 的准确 pinned SVG URL 实际 HTTP 404，才调用官方字体提取 helper。保留准确原连字，官方 Google Fonts 静态子集的 GSUB 唯一匹配 `uniE87D`；FILL0/opsz24/wght400/GRAD0，960 units/em。原 CSS/TTF、版本/hash、GSUB sequence 与坐标变换证明存于 `docs/design-sources/material-symbols-favorite-border-fill0/`，manifest 单独标注字体 sourceProof，未归入固定SVG来源。未换成 favorite 或其他近似图形；许可见既有 Apache-2.0 文档。

## 本次验证与边界

一次临时只读资产核对通过：17枚 SVG 解析、根颜色、manifest SHA256、16枚固定源 SHA256与逐子元素路径一致；favorite_border 原连字/FILL证明；WXML + 既有 JS 筛选所有17枚本地引用存在，所有 image mode 明确。本页 JS、8张 JPEG及 `reference-sources.json` 与基线逐字节一致。未运行全量测试或已通过的业务套件，未添加镜像样式测试，未操作模拟器、提交或改共享文件。

R1仍只读本人 `/me/events`、真实状态/身份隔离/三种筛选与同ID活动详情路由；goCreate、更多菜单与 shared navigation 不变。此资产核对不构成视觉模拟器、真机、外部服务或39屏逐像素验收。
