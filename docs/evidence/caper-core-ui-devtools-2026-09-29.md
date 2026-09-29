# CAPER 核心页面模拟器回归（2026-09-29）

设计依据：用户提供的 `stitch_design_system_generator (2).zip` 中 `pg03_ai`、`caper_ai`、`pg04`、`caper_1`、`caper_3` 等页面。仍使用现有 Project IRL R1 服务端和测试 AppID `wxbbcab69099026d3f`；本次数据为本机测试身份与本地 API。

| 页面 | 开发者工具渲染 | 实际点击回读 |
| --- | --- | --- |
| AI 建局 | [截图](images/caper-create-idea-2026-09-29.png) | “不使用建议，直接手动填写”进入 `FORM`；表单[截图](images/caper-create-form-2026-09-29.png)。快捷“本周六”回读日期 `2026-10-03`；“草稿箱”跳到首页且 `activeTab=organized`。 |
| 我的 | [截图](images/caper-profile-2026-09-29.png) | “关于 Project IRL”进入 `pages/about/about`。 |
| 消息 | [截图](images/caper-messages-2026-09-29.png) | “活动相关”回读 `filter=ACTIVITY`；搜索图标打开只针对已加载真实通知的搜索；设置图标进入 `pages/me/me`。 |

`node --import tsx --test` 合跑小程序、路由、城市、发起、个人和消息的定向验证 **119/119**；本地 `pnpm test` 全量 **706/706**，`pnpm typecheck` 与 `git diff --check` 退出 0。微信开发者工具 CLI 预览编译成功，总包 1,411,073 Byte（主包 1,369,472 Byte、个人分包 41,601 Byte）。这项记录只证明本地模拟器渲染与所列按钮点击，不能替代真机、正式 AppID、外部订阅消息或真人运营活动。设计包中的私聊记录、人物照片、已获勋章、相册、全品类活动和社交统计没有真实数据或 R1 接口，当前页面显示清晰的未开放状态，尚未达到全套设计 1:1。
