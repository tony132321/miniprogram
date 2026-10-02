# Stitch 个人与关于设计组接入记录（2026-09-29）

设计来源为用户提供的 `stitch_design_system_generator (2).zip`：`caper_1`、`pg10_a_edit_profile`、`pg10_b_social_badges`、`pg10_c`、`pg10_d`、`pg10_e`、`pg10_f`、`pg10_g`、`pg10_h_project_irl`、`pg10_h_1`、`pg10_h_2`、`pg10_h_3`。现有 `pages/me/me` 和 `pages/about/about` 继续承载个人主页及关于页；其余十个视觉状态位于 `subpackages/profile/`，使用原生 WXML/WXSS、独立顶部返回，不复制示例人物、照片或虚构统计。底部导航由主包的 custom-tab-bar 统一承载。

| 设计页 | 当前小程序入口 | 数据和交互边界 |
| --- | --- | --- |
| `caper_1` | `pages/me/me` | 顶栏采用“耍起 CAPER”、蓝/荧光绿配色、贴纸、四列统计/勋章、兴趣标签、隐私开关、双列活动卡与主理人工具；四列统计与活动卡读取真实 `/me/events` 和通知数据。沿用微信登录、活动提醒与类似邀请同意、站内通知、隐私请求与导出、举报和申诉。 |
| `pg10_a` | `subpackages/profile/profile-edit/profile-edit` | 城市选择复用设备本地状态；全局头像、昵称、性别、签名、兴趣和等级没有保存接口，仅给出状态说明。活动内昵称仍在活动详情按本场同意管理。 |
| `pg10_b` | `subpackages/profile/badges/badges` | 勋章方向仅作空态示意，不显示已获得数量或用户等级；可返回真实活动记录。 |
| `pg10_c` | `subpackages/profile/moments/moments` | 相册未开放，不显示设计包中的人物照片；说明上传、同场可见、删除与人脸检索尚需权限和保留策略。 |
| `pg10_d` | `subpackages/profile/privacy-safety/privacy-safety` | 读取真实 `/me/blocks`、调用撤回接口，退出或换身份先清空旧列表；安全求助转到已有举报入口。 |
| `pg10_e` | `subpackages/profile/legal/legal` | 说明当前本人数据操作；正式协议、第三方清单、公司、备案、邮箱及法律同意状态未核定，不伪造。 |
| `pg10_f` | `subpackages/profile/cache/cache` | 原生 `wx.getStorageInfoSync` 回读设备存储大小与比例；当前无可安全独立清理的设计稿缓存类别，不执行清空全部存储。 |
| `pg10_g` | `subpackages/profile/support/support` | 常见问题可展开；安全举报转到现有本人工单入口；普通反馈、客服账号、图片上传和 AI 客服未开放。 |
| `pg10_h`、`pg10_h_1/2/3` | `pages/about/about`、`subpackages/profile/release-notes`、`guidelines`、`open-source` | 关于、当前 R1 能力、安全引导、实际工程依赖许可说明。未沿用设计稿虚构的版本号、日期、备案和支持联系方式。 |

定向验证：`node --import tsx --test test/pg10-profile-navigation.test.ts test/miniprogram-profile-create-gates.test.ts test/miniprogram-binding-routes.test.ts` 为 **10/10**；与首页、发起、消息及既有小程序测试合跑 **119/119**，静态检查覆盖 18 页、286 个事件绑定及 63 条字面路由；`pnpm typecheck` 与 `git diff --check` 退出 0。微信开发者工具中已渲染个人主页，并实点“关于 Project IRL”进入关于页；截图及其他页面点击见[核心 UI 模拟器记录](caper-core-ui-devtools-2026-09-29.md)。正式身份和真机证据需单独记录。CAPER 参考图的人像、等级、已获勋章、个人兴趣与活动封面没有对应真实数据或上传/保存接口，因此当前仅保留明确的空态/说明及纯视觉占位。
