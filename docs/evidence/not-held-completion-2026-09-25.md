# 未举办活动结项验证（2026-09-25）

主办方结项表单现在要求明确选择“实际举办”或“未举办”，不预填实际到场人数。选择未举办时提交 `held=false`、`actualCount=0`；选择已举办时须手填人数。服务端拒绝 `held=false` 同时声明有到场人数，避免矛盾记录进入结项和试点指标。

`test/miniprogram.test.ts` 用页面脚本模拟表单选择与提交值，覆盖未选择、未填写人数和两种合法选择；`test/lifecycle.test.ts` 用真实本地数据库验证矛盾记录被拒绝，未举办记录的证据等级为 `NOT_HELD`。当时全量 `pnpm test` **170/170**、`pnpm typecheck`、页面脚本语法检查与 `git diff --check` 通过；当时只有本地验证。下方补充开发者工具模拟器回归，真机控件交互仍待验。

2026-09-25 追加微信开发者工具模拟器回归：在独立 `.data/wechat-completion-20260925` 测试库中，先按正常业务规则创建两场邀请活动、由四个开发身份确认并成局，再只在该测试库中把活动开始／结束时间字段移到过去，以打开结项入口。两场均在页面运行时选择结项分支，实际举办场填写了到场人数；页面方法 `complete` 提交后服务端分别返回 `held=false, actualCount=0, level=NOT_HELD` 和 `held=true, actualCount=4, level=HOST_ONLY`。模拟器[未举办结果](wechat-completion-not-held-2026-09-25.jpg)和[举办结果](wechat-completion-held-2026-09-25.jpg)显示对应证据等级，后者明确提示可信完成仍需独立反馈；console 未见错误。

单选状态通过开发者工具元素事件触发，人数通过模拟器输入框填写，结项通过页面方法调用；本次未完成手指点击整套控件的验证。数据库时间字段为本地测试而调整，因此不能据此证明自然截止任务、真实到场或真机相机交互。正式业务时间线与线下独立证据仍应单独验收。

补充完整模拟器页面操作：在同一独立测试库中另建两场邀请活动，均按正常业务规则由主办方和三位开发身份确认并成局，再仅将该测试库的活动开始／结束字段移到过去。两场主办方页面的结项单选项均初始未选；给两个选项标签、人数输入框及提交按钮加稳定元素 ID 后，通过开发者工具 `tap` 实际点击标签和按钮。其中“未举办”分支选择标签后页面数据为 `completionHeld: false`，点击按钮得到 `COMPLETED / NOT_HELD / actualCount: 0`，页面与服务端一致，见[未举办按钮操作结果](wechat-completion-button-2026-09-25.jpg)。“实际举办”分支选择标签后页面数据为 `completionHeld: true`，通过输入框输入 `4` 后点击按钮，页面与服务端均为 `COMPLETED / HOST_ONLY / actualCount: 4`，见[举办按钮操作结果](wechat-completion-button-held-2026-09-25.jpg)。这补足了模拟器元素点击链路；仍未验证真机手指操作、自然到期或线下到场事实。

上述元素 ID 与文档修改后，全量 `pnpm test` **224/224**、`pnpm typecheck`、`git diff --check` 通过。
