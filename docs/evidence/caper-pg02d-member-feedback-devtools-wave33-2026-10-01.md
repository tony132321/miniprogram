# PG02-D 已结项成员历史卡反馈入口：隔离模拟器实点（2026-10-01）

## 范围与环境

- 检查的是已提交代码 `7aac76f09a932d4cf2f07f9239f8b8fe49420a99` 的首页历史卡主按钮。将完整 `miniprogram/` 复制到 `/private/tmp/project-irl-wave33-member/miniprogram-project/miniprogram/`；与仓库逐文件比较时，仅本地 `config.js` 和 `.DS_Store` 排除，`diff -qr` 退出 0。
- 隔离项目用微信开发者工具测试 AppID `wxbbcab69099026d3f`，本地合成 API `http://127.0.0.1:3037`。微信 CLI `auto --project /private/tmp/project-irl-wave33-member/miniprogram-project --auto-port 9523 --port 21467 --trust-project` 退出 0；自动化会话连接独立端口 `9523`。脚本为 `/private/tmp/project-irl-wave33-member/member-history-smoke.cjs`。
- 合成活动 `dca728a9-f387-4fbf-a301-4f8558ee2f6b` 的 API 状态为 `COMPLETED`；测试成员 `caper-pg08-muo8i0wn-member-1` 和 `caper-pg08-muo8i0wn-member-3` 的 `/me/events` 均为非主办、报名 `CONFIRMED`。未创建新活动；成员 3 的一条反馈仅写入此本地合成 API，用于验证已提交后的只读回路。

## 实点结果

| 步骤 | 观察 |
| --- | --- |
| 首页“历史”标签 | 实际点击标签后，当前分类为 `history`，目标合成活动显示“查看结项与反馈”主按钮。 [历史卡截图](images/caper-wave33-pg02d-member-history-primary-2026-10-01.png) |
| 点击该卡主按钮 | 顶层页面变为 `pages/event/event`，回读的活动 ID 不变，分区为 `checkinSection`；结项读取状态为 `READY`，已确认成员的 `#feedbackForm` 与“提交独立反馈”按钮渲染。 [反馈表单截图](images/caper-wave33-pg02d-member-feedback-form-2026-10-01.png) |
| 写入边界 | 同一成员的 `/events/:id/outcome` 回读在点击前后 `myFeedbackSubmitted` 均为 `false`；按钮导航没有代替本人提交反馈。MiniProgram Automator 捕获页面异常 **0**。 |
| 已提交后的回路 | 换用此前没有反馈的合成成员 3，从历史卡进入表单，实际选择“顺利举行了”和“想！多来一些”并点击提交；本地 API `myFeedbackSubmitted` 从 `false` 变为 `true`。重新从“历史”卡实点主按钮，仍到同场 `checkinSection`，可见 `#memberFeedbackCard` 的“独立反馈已记录”；`#feedbackForm` 和提交按钮均不存在。[只读反馈卡截图](images/caper-wave33-pg02d-member-feedback-recorded-2026-10-01.png)。这一步捕获页面异常 **0**。 |

成员 3 的一次合成反馈使本地活动的 `independentFeedback` 计数成为 1；成员 1 的 `myFeedbackSubmitted` 回读仍为 `false`，原有未提交表单 fixture 保留。两轮实点脚本分别为 `/private/tmp/project-irl-wave33-member/member-history-smoke.cjs` 和 `/private/tmp/project-irl-wave33-member/member-recorded-smoke.cjs`。截图与回读证明该合成活动下的表单及只读分支；不代表其他账户、真机、正式 AppID、线上 API 或 39 页逐像素验收。本轮没有运行全量测试。
