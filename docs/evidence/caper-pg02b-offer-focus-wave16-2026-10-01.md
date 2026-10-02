# CAPER PG02-B 候补补位卡直达处理（2026-10-01）

## 范围与参考

参照 `/Users/tsb/Downloads/stitch_design_system_generator (2).zip` 的 `pg02_b/screen.png` 待确认活动卡，修正首页 `OFFERED` 卡主按钮原先只打开“我的”通用通知区的问题。本轮只改首页、个人页、相关定向测试；未改报名服务端、活动详情、城市模块或中央验收矩阵。

## 现有业务契约

- `GET /me/notifications` 只返回当前成员通知，未读优先，每页最多 100 条；后续页使用 `nextOffset` 与 `snapshot`，队列变化返回 `QUEUE_CHANGED`。`WAITLIST_OFFER` 行有 `event_id`、`event_version`、`detail.offerId`、`detail.expiresAt`，以及按服务端当前 offer / 门禁计算的 `actionable`、`declinable`。
- `GET /events/:id` 提供当前活动版本，`GET /me/events` 提供当前成员的报名状态。通知列表没有按活动直接查询 offer 的接口，故个人页沿现有快照分页定位对应通知。
- `POST /offers/:id/accept` 与 `/decline` 接收 `expectedVersion`；服务端再次核对身份、版本、活动与 offer 的有效期。暂停时可保留放弃补位而阻止接受。

## 页面行为

首页只保存一次性 `{ eventId, owner }` 导航意图并切换“我的”，不发送接受或放弃请求。`owner` 在正式登录下包含 `userId` 与当前 `sessionToken`，在开发模式下包含当前测试身份；个人页读取后即删除，账号或会话已换则丢弃。

个人页重新读本人活动和通知，核对报名仍为 `OFFERED` 与当前活动版本，然后按通知快照最多读取 **5 页（含首屏）**，查找**同一活动**、版本一致、未过期、服务端标记可接受或可放弃的真实 offer。找到后展开通知区并滚动到该通知卡，只显示服务端当前允许的动作；若只有放弃权限，仍可放弃。找不到、版本变化、过期或分页失败时给出不可操作提示；超过 5 页时提示到全部通知中查找或刷新，不假称已遍历所有通知。通知快照变化可有限重读；账号私有数据已清空时，延迟完成的活动回读不会重新聚焦旧 offer。服务端在按钮点击时拒绝过期或版本冲突，页面重读通知并隐藏该 offer 的按钮。按钮请求进行期间换账号、换会话或离开页面时，旧请求的成功或失败结果不会改写新页面焦点与提示。

## 验证

- 新定向测试先见到首页缺少活动意图、个人页无目标焦点、过期拒绝后不重读、同用户换会话仍错误聚焦、旧举报焦点抢占、版本冲突后仍显示按钮、定位读取第 6 页及清空私有数据后旧响应继续聚焦等预期失败；修复后通过。快照变化重读另有定向覆盖。
- 页面相关 5 个定向测试文件：**54/54** 通过；新增两个延迟请求用例先失败，后验证账号切换时旧成功或错误均不能改写新页面。
- 后端 `member-notification-queue.test.ts` 与 `notifications.test.ts`：**20/20** 通过，覆盖 100 条以上分页、本人隔离、暂停时只能放弃、到期与外部通知边界。
- 扩展的既有 `test/miniprogram.test.ts` 在并行城市夹具补齐后重跑：**89/89** 通过。
- `test/miniprogram-binding-routes.test.ts` 在并行城市夹具补齐后重跑：**1/1** 通过，检查 20 页、575 个事件绑定及 119 条字面路由。
- `tsc --noEmit`、本轮文件 `git diff --check`：退出码 0。
- 未运行全量测试。

## 合并后微信开发者工具实点

本地提交 `496061f` 的完整 `miniprogram/` 同步到隔离项目 `/private/tmp/caper-r1-e2e-20260930/miniprogram-project`；与提交比较仅 `config.js` 指向本机合成 API `127.0.0.1:3037`，`diff -qr --exclude=config.js` 退出码 0。微信开发者工具 CLI `auto --project /private/tmp/caper-r1-e2e-20260930/miniprogram-project --port 21467 --auto-port 9494 --trust-project` 返回实际自动化端口 `9495`，测试 AppID 为 `wxbbcab69099026d3f`。

合成活动 `202fdfc1-3c1f-4608-82a0-6e2cbf7c6319` 进入 `OFFERED` 后，自动化实点首页“确认或放弃补位”，切至 `pages/me/me`，高亮同场通知 `e3ea7534-2295-4ad2-96ab-fddd7e41d262`；页面当前 offer 的 `actionable` 与 `declinable` 均为真，运行异常 0，烟测脚本退出码 0。computer use 复核开发者工具当前页可见目标通知、截止时间及“主动确认补位”“拒绝补位”两个按钮。截图：[首页卡片](images/caper-pg02b-offer-home-wave16-2026-10-01.png)、[目标通知](images/caper-pg02b-offer-focused-notice-wave16-2026-10-01.png)。隔离项目 CLI `preview` 退出码 0、包体 **2,087,577 Byte**。合成种子和点击脚本位于 `/private/tmp/project-irl-wave16-devtools/seed-offer.cjs`、`offer-ui-smoke.cjs`。

首次自动化脚本在切页瞬间收到 `page not on top` 并退出；重试后完成了上述跳转、按钮和运行异常检查。此实点验证定位和按钮可见，未实际提交接受或拒绝请求；它不构成同尺寸 1:1、真机、正式环境或外部通知验收。通知量很大时，自动定位最多读取 5 页；快照持续变化或续页失败也会停止定位并提示重试。
