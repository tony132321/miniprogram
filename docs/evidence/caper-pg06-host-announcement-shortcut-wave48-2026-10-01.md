# PG06 主办工作台“发送公告”定位闭环（2026-10-01）

对照 v3.1 R1 验收矩阵的 RQ11 公告问答及 Stitch ZIP `pg06/screen.png`：主办工作台底部“发送公告”原先打开普通成员的公告问答分区，没有到达页面已有的主办公告输入框。现改为点击后回读当前活动与账号资格；仅当仍为同场主办、活动审核通过且处于招募中、已成局或进行中，才打开主办工作台并定位到现有 `#hostAnnouncementAnchor`，其后就是 `#hostAnnouncementForm`。其他状态显示“查看公告”并进入只读内容区。此按钮只定位表单，不自动提交；提交仍走现有 `/events/:id/content` 审核链路。

新增定向测试先因缺少 `openHostAnnouncement` 失败，修复后覆盖当前主办正常定位、已成局／进行中、主办资格撤销、活动或审核状态变化、账号切换及页面隐藏后的旧回调。活动页相邻四份定向测试 **39/39**，`tsc --noEmit`、活动页脚本语法和 `git diff --check` 通过；未运行全量测试，没有新增服务端接口。

## 隔离微信开发者工具实点

- 仅把当前 `event.js`、`event.wxml` 同步到隔离项目 `/private/tmp/irl-pg10f-wave48-sim`；微信开发者工具 CLI `preview` 退出 0，包体为 `2,233,583` 字节。后端使用 `127.0.0.1:3037` 的受控合成活动，该活动回读为 `APPROVED`、`RECRUITING`，当前合成账号仍是主办人。
- Automator 打开 `pages/event/event` 的主办工作台，实点“发送公告”。页面仍是同一活动及 `hostSection`，滚动位置从 `0` 到 `910`，`#hostAnnouncementAnchor` 顶部约 `-0.25` 像素（模拟器亚像素误差），`#hostAnnouncementForm` 的“主办方公告”输入框和“提交公告”按钮可见。 [点击后的模拟器截图](images/caper-pg06-host-announcement-shortcut-wave48-2026-10-01.png)未包含有效邀请码。
- 点击前后 `announcementText` 均为空；服务端该活动公告问答条数为 `0 → 0`；本次路线捕获 `exception=0`。自动化**没有点击“提交公告”**，因此仅证明入口定位，不把内容提交和审核链路视为本轮实点验证。真机布局仍待设备复核。
