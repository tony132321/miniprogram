# PG05-S 报名成功卡“加日历”定向证据（2026-10-01）

## 设计与实现

- 用户提供的 `stitch_design_system_generator (2).zip` 中，`stitch_design_system_generator/pg05_s/screen.png` 的活动时间行右侧有“加日历”按钮；`code.html` 的 `add-calendar-btn` 仅调用展示成功提示的占位函数，并没有写入日历。
- 当前小程序 `miniprogram/pages/event/event.wxml` 在 `successState=JOINED` 的时间行加入“加日历”按钮，`event.wxss` 为其提供与参考稿相近的紧凑胶囊布局。按钮只在报名成功卡可见。
- 点击后，`event.js` 通过既有 `refresh()` 重读 `/me/registrations?eventId=...` 和同场 `/events/:id`。仅当当前身份、活动 ID、页面状态和本人 `CONFIRMED` 席位一致，且最新活动名称、开始和结束时间有效并尚未开始，才调用 `wx.addPhoneCalendar`。写入字段使用最新活动 `title`、`startAt`、`endAt`、`city` 与 `venueName`，不携带邀请口令。
- 按[微信开放文档](https://developers.weixin.qq.com/miniprogram/dev/api/device/calendar/wx.addPhoneCalendar.html)及其[官方 API 类型](https://github.com/wechat-miniprogram/api-typings/blob/master/types/wx/lib.wx.api.d.ts)，先检查原生接口／基础库是否可用；`startTime` 传 Unix 秒数的 `number`，`endTime` 传 Unix 秒数的 `string`。未授权、不支持和接口失败显示相应提示；只有原生成功回调后才显示“已添加到日历”。页面隐藏、切换账号、重新刷新或旧回调不能给新页面报成功。

## 定向验证

| 检查 | 结果 |
| --- | --- |
| 新增用例先行运行 | `node --import tsx --test --test-name-pattern='PG05-S calendar' test/event-caper-navigation.test.ts`：新增 **4/4 按预期失败**，分别因为时间行缺少绑定及 `addJoinedCalendar` 未实现。 |
| 实现后的日历用例 | 同命令 **4/4 通过**：核对最新时间／地点和官方参数类型、资格撤销、刷新中切账号、无效时间、不支持、拒权及迟到回调。 |
| 相邻活动页回归 | `node --import tsx --test --test-concurrency=1 test/event-caper-navigation.test.ts test/miniprogram-event-screen-navigation.test.ts`：**33/33 通过**。 |
| 静态检查 | `node node_modules/typescript/bin/tsc --noEmit`、`node --check miniprogram/pages/event/event.js`、`git diff --check` 均退出 0。 |

本轮未运行全量测试。微信开发者工具 IDE 的 CLI 端口 `21467` 正被并行页面验证共用；为避免覆盖其他人的模拟器页面，本轮未切换其隔离项目，因此**没有本按钮的开发者工具实点截图或原生授权弹窗证据**。只读 Computer Use 窗口状态调用超时，未取得可用界面。系统日历的实际落盘、授权弹窗与拒绝后的重新授权仍需在具备正式环境的真机上验证；日历事件写入后不会随活动后续变更自动更新，用户应以小程序内最新安排为准。

上述日历成功／失败回调由单元测试中的 `wx.addPhoneCalendar` VM 桩手动触发，证明页面处理与提示门控，不证明微信模拟器已调用原生接口，更不证明系统日历已持久保存。
