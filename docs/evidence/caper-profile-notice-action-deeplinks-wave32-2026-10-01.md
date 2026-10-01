# 个人页活动通知动作深链（2026-10-01）

## 缺口与修复

个人页站内通知卡此前对所有带活动 ID 的提醒都只打开活动总览。更严重的是，`openNotice` 直接使用按钮携带的 ID、活动 ID 和种类：列表中的通知 A 可以被伪造为跳转活动 B，并把 A 标记已打开。本次复用已有活动分区、结项表单和反馈表单，不新增业务提交。

- `openNotice` 只接受当前身份、当前已成功加载且实际在列表中的通知行；ID、活动 ID、种类必须与被点击行一致。尚未加载的分页项、旧账号行、伪造行及刷新中的旧行均不会导航或标记已打开。导航使用匹配行自身字段，通知 ID 作为 URL 路径段时编码。
- `MATERIAL_CHANGE` 进入 `registrationSection`；`EVENT_REMINDER` 与 `MANUAL_CHECKIN_REQUEST` 进入 `checkinSection`。
- `EVENT_OUTCOME_DUE` 进入 `hostSection&entry=hostCompletion`；`EVENT_OUTCOME_REVIEW` 进入 `checkinSection&entry=memberFeedback`。这两个通知缺活动 ID 时不消费动作。活动详情加载后再按活动 ID、当前身份、主办／已确认成员资格、活动状态、结项时间与证据加载状态判断是否聚焦表单；不符合时留在对应分区概览。
- 举报、申诉等处理记录仍在个人页对应分区。通知标记已打开只发生在 `wx.navigateTo` 成功回调之后；这个回调本身不能证明目标页已加载或聚焦成功。点击通知不提交结项或成员反馈。

## 定向验证与微信模拟器

- 测试先复现了伪造活动 ID、伪造通知 ID／类型与未加载分页项可被消费，以及反馈提醒缺少表单入口的失败。修复后，个人页、消息中心、活动页、会话隔离和结项按钮相关 10 个聚焦测试文件 **97/97** 通过；`pnpm typecheck` 与所改文件 `git diff --check` 通过。未运行全量测试。
- 模拟器实点时，`miniprogram/` 与隔离的微信开发者工具工程除本地 `config.js` 外 `diff -qr` 无差异，微信 CLI 对测试 AppID `wxbbcab69099026d3f` 的预览成功，包总计 **2,155,780 Byte**。随后只增强活动页空身份守卫；同步后的完整小程序差异仍为 0，最终 CLI 预览 **2,155,832 Byte**，受影响三文件定向 **26/26** 通过。该最后修正没有重复模拟器实点。
- 在模拟器以开发身份 `caper-pg06-end-muojsyze-host` 打开个人页，展开“账号与安全操作”，实点通知 `d33f2d6f-b642-46ea-990b-159e36d30da3` 的“查看通知并标记已打开”。该通知原先已是 `OPENED`，因此本轮仅证明该入口导航、主办工作台及现有结项表单实际渲染；点击前后状态均为 `OPENED`。活动 `d444bdcf-30ec-49f5-8913-a1855128cc36` 的结项 API 前后均为 HTTP 404，未提交结项；模拟器异常 0。见[个人页通知卡](images/caper-wave32-profile-outcome-before-2026-10-01.png)和[目标结项表单](images/caper-wave32-profile-outcome-form-2026-10-01.png)。
- 原生 CUA 未提供可完成的该应用界面操作（应用名识别失败，后续应用盘点超时）；上述实点使用微信 CLI 与其 MiniProgram Automator 模拟器会话。成员反馈提醒没有具资格的实点样本，本轮以活动页资格守卫和聚焦测试覆盖。

正式 AppID、HTTPS 合法域名、订阅模板、真机和真人受控活动仍按总验收矩阵单独验收。
