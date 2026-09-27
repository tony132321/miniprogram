# 候选版微信开发者工具模拟器核验（2026-09-27）

本次只核验当前工作区的小程序候选版，没有上传或发布小程序，也没有改动业务代码。已安装并登录的微信开发者工具通过 `wechatide` `0.3.11` 接入；项目根目录为 `/Users/tsb/Documents/小程序`，使用仓库本地测试 AppID 和 `miniprogram/config.js` 的本地 API 地址。以 `DEV_AUTH=1` 启动本机 API，数据存入新建的隔离 PGlite 目录 `.data/wechat-candidate-20260927-2000`；`GET /ready` 返回 `{"status":"ready"}`。核验后已停止 API。

1. `wechatide -c irl-candidate simulator_open_page --project /Users/tsb/Documents/小程序 --page pages/index/index` 成功。随后打开 `pages/event/event` 的合成邀请入口，工具返回 `success: true`；页面运行时为 `loadState=READY`、`safetyStatus=OPEN`、`status=RECRUITING`。单文件 `compile_wxml pages/event/event.wxml` 返回 `$gwx`，`compile_wxss pages/event/event.wxss` 返回 `success: true`。这包含整页模拟器编译打开与 WXML/WXSS 单文件检查，不能代替真机编译。
2. 通过本地 API 创建一场标题为“模拟器候选版签到联动（合成）”的邀请制活动（ID `de8f39b7-1fbf-419c-b5b7-9dfd67249eb3`，版本 2，活动开始前 20 分钟建局），并以合成账号 `p1`、`p2` 预置报名；主办 `host` 自占一席。模拟器切到合成账号 `p3`，活动页为 `READY`、`canJoin=true`。对报名确认弹窗临时 mock `wx.showModal` 为同意，实际点击 `#joinButton` 后立即恢复原 API。页面显示本人报名 `CONFIRMED`、接受版本 2；本人 HTTP `/me/registrations` 回读相同。
3. 模拟器切回合成主办账号，活动页列出四名 `CONFIRMED` 成员；实际点击 `#confirmEventButton`。页面显示 `CONFIRMED` 和“主办方已确认成局”，主办身份 HTTP 活动详情回读 `status=CONFIRMED`、`stats.confirmed=4`。
4. 主办页通过 automator 的 `automation_page_action callMethod showCheckInToken` 调用页面方法，运行时出现动态口令及剩余秒数。切回 `p3` 后，页面为 `canCheckIn=true`；使用 `automation_element_action input` 在真实“现场动态签到口令”输入框输入令牌，再通过 `automation_page_action callMethod checkIn` 调用页面方法。首枚口令已轮换，页面正确提示“签到码已失效”，HTTP 没有产生签到行。重新从主办 API 取得当前口令并重复页面输入与方法调用后，页面显示“签到证据已记录”、`attendanceLoadState=READY`、`p3 · 到场证据 SCAN`；本人 HTTP `/events/{id}/checkins` 回读一条 `SCAN` 记录。控制台 `error|fail|exception` 过滤查询为空。

本次的 `p3` 报名与主办成局均实际点击了模拟器元素；签到输入由模拟器元素交互完成，签到提交由页面方法触发，未声称实际点击了无稳定 ID 的“记录签到证据”按钮。动态码生成也由页面方法触发。模拟器中的合成身份、弹窗 mock 和页面方法调用不能证明正式微信身份、真机相机扫码、真实场地或线下到场。临时截图保存在本机 `/tmp/irl-candidate-event-joined-20260927.jpg` 与 `/tmp/irl-candidate-event-checkin-row-20260927.jpg`，未复制进仓库；页面状态同时由运行时和本地 API 回读核对。
