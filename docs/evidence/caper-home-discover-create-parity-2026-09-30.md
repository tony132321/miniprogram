# CAPER 首页、发现和发起页长图对照（2026-09-30）

对照用户提供的 ZIP 中 `caper_2`、`caper_4`、`pg03_ai`、`caper_ai`、`pg04` 原图及 HTML。使用微信开发者工具测试 AppID `wxbbcab69099026d3f`、本机 API `127.0.0.1:3000`、合成身份 `host`；开发者工具 CLI `preview` 对本轮合并工作区编译退出码 0，总包 1,834,228 Byte。以下照片均为设计场景素材，不代表真实活动参与者。

| 页面 | 本轮实点／回读 | 图片 |
| --- | --- | --- |
| 首页 `caper_2` | 补全原稿首屏之后的四张灵感小卡、四格主题、横向本人活动、构思列表、照片拼贴、说明卡、城市夜景与页尾发起 CTA。横向活动卡只取当前身份 `/me/events`，身份切换测试验证旧账号数据被清空。微信开发者工具回读 `loadState=READY`、2 场本人活动、1 场近期预览，页面异常 0。 | [首屏](images/caper-home-longfeed-top-2026-09-30.png)、[主题与本人活动](images/caper-home-longfeed-themes-2026-09-30.png)、[拼贴与城市](images/caper-home-longfeed-city-2026-09-30.png) |
| 主办多场分流 `pg02_c` | “我的”有多场可邀请活动时转首页“我组织的”；招募中每张真实主办卡新增独立邀请按钮。实点后进入 `subpackages/activity/share/share?id=74716b6d-3a87-40b6-91b8-9117fa354bde`，目的页 `loadState=READY`，异常 0。邀请页仍独立核验服务端审核与招募资格。 | [邀请目的页](images/caper-home-host-share-route-2026-09-30.png) |
| 发现 `caper_4` | 恢复紧凑同排导航、黄色贴纸、四张主卡的英文标题及双标签，补齐原图的附近布局、主题条、灵感照片和城市卡。图片明确写“发起灵感”；收藏按钮提示未开放，本人活动“查看全部”实点到真实 `/me/events` 页面。开发者工具异常 0。 | [首屏](images/caper-discover-parity-top-2026-09-30.png)、[中段](images/caper-discover-parity-mid-2026-09-30.png)、[底部](images/caper-discover-parity-bottom-2026-09-30.png) |
| 发起 `pg03_ai`、`caper_ai`、`pg04` | IDEA 灵感和手填入口、FORM 真实字段、REVIEW 逐行核对按原稿收紧。羽毛球灵感填入真实输入，手填进入 FORM；咖啡灵感和语音入口提示未开放且不更改羽毛球草稿；REVIEW 的更多菜单可返回编辑或打开草稿箱。合成草稿回读版本 5，页面异常 0。 | [IDEA](images/caper-create-idea-parity-2026-09-30.png)、[FORM](images/caper-create-form-parity-2026-09-30.png)、[REVIEW](images/caper-create-review-parity-2026-09-30.png) |

本批首页多场邀请先写测试、确认缺少页面方法后再实现，定向 12/12 通过；首页长期视图身份切换测试也先失败后通过。发起页代理报告相关测试 101/101、AI 边界 93/93；发现页代理报告定向 92/92。合并后完整本机测试和新 GitHub CI 仍以当前批次最终结果为准。

设计原图中的公开活动搜索／位置、虚构场次数字、用户头像／评价、实时推荐和真实外部 AI 模型没有 R1 可验证的数据来源。此轮保留模块的构图及可点击入口，用当前本人数据或明确标注的灵感承载，不把设计照片伪装成可报名场次。微信原生胶囊、真实必填字段和服务端安全状态仍造成视觉差异；本证据不构成逐像素、真机或正式服务验收。
