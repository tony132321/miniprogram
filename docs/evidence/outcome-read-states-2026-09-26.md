# PG08 结项证据读取与反馈恢复

已结项活动原先在 `/events/:id/outcome` 读取失败时静默返回空值，隐藏结项证据及参与者独立反馈入口。现在页面把有效结项证据显示为 `READY`，把网络或服务错误显示为 `ERROR`、权限错误显示为 `FORBIDDEN`；失败时清除旧证据，并提供沿用活动刷新的重试按钮。尚未结项的活动不请求该接口，保持 `IDLE`。

先添加页面行为测试并确认旧代码失败，随后覆盖失败、重试成功、无权和旧证据清理。微信开发者工具 `0.3.11` 的 WXML 编译通过。在独立结项测试库 `.data/wechat-completion-20260925` 中，以已确认参与者 `p1` 打开已举办的完成活动；本地代理仅让结项 GET 返回 503，页面显示[错误和重试](wechat-outcome-retry-error-2026-09-26.jpg)。恢复接口后，实际点击 `#outcomeRetryButton`，运行时从 `ERROR` 变为 `READY`，`myFeedbackSubmitted=false`，[独立反馈入口重新出现](wechat-outcome-retry-ready-2026-09-26.jpg)。本轮没有提交反馈或改变测试库中的业务记录。测试服务已停止，临时代理已移除。

全量 `pnpm test` 通过 318/318；`pnpm typecheck`、`git diff --check` 和 `compile_wxml pages/event/event.wxml` 通过。此证据只覆盖本地模拟器的结项读取恢复；真机网络和真实线下反馈仍待验。
