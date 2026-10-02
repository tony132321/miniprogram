# Wave 18 PG08／PG10-A 微信开发者工具定向实点（2026-10-01）

## 源码与环境

本地提交 `88511fe94e6bd37961595ae53af917788fa1181b` 的 `miniprogram/` 已同步到隔离项目 `/private/tmp/caper-r1-e2e-20260930/miniprogram-project`；只保留其 `config.js` 指向本机合成 API `http://127.0.0.1:3037`。`diff -qr --exclude=config.js miniprogram /private/tmp/caper-r1-e2e-20260930/miniprogram-project/miniprogram` 退出码 0。微信开发者工具 CLI `preview --project /private/tmp/caper-r1-e2e-20260930/miniprogram-project --port 21467` 退出码 0，测试 AppID `wxbbcab69099026d3f`，总包 **2,115,788 Byte**。自动化端口为 `9495`。

原生 Computer Use 尝试读取开发者工具窗口时返回“Mac is locked and automatic unlock could not unlock it”，因此本次原生窗口 AX／屏幕观察未取得；以下点击与截图来自微信开发者工具 CLI 的 `miniprogram-automator` 模拟器会话。

## 合成活动与业务门控

复用隔离 API 中既有 PG08 合成活动 `dca728a9-f387-4fbf-a301-4f8558ee2f6b`。业务接口只读回读显示主办 `caper-pg08-muo8i0wn-host`、版本 2、活动结束时间已过；成员 `caper-pg08-muo8i0wn-member-1` 和 `...-member-2` 均为 `CONFIRMED`，结项前 `/outcome` 为 404。随后使用主办身份、预期版本和固定幂等键，正常调用一次 `POST /events/:id/complete`（`held=true, actualCount=4, issues=[]`）。回读活动 `COMPLETED`、结项级别 `HOST_ONLY`、成员 1 仍未提交独立反馈。限定脚本：`/private/tmp/project-irl-wave18-devtools/complete-fixture.cjs`，退出码 0；未直接改数据库或真实服务。

## 模拟器点击结果

定向脚本 `/private/tmp/project-irl-wave18-devtools/pg08-pg10-smoke.cjs` 退出码 0，页面异常 **0**。

- PG08：以已确认成员 1 进入 `checkinSection`，页面及结项读取均为 `READY`，真实反馈表单可见。实际逐一点选“顺利举行了／未能举行”和“想！多来一些／暂时不”，页面数据分别变为布尔真／假；在“未举办原因（必填）”中输入合成说明后，页面数据保留该文本。再次切回两项肯定选择，说明没有丢失。[四选项与说明截图](images/caper-pg08-feedback-four-choices-wave18-2026-10-01.png)。实际点击“再来一局”进入 `pages/create/create`，阶段为 `IDEA` 且无当前编辑活动；[空白构思页截图](images/caper-pg08-fresh-idea-wave18-2026-10-01.png)。**没有点击“提交独立反馈”。**
- PG10-A：以已确认成员 2 打开资料编辑页，点击“设置本场昵称”，选择面板从 `/me/events` 加载到 1 场真实本人活动；[选择面板截图](images/caper-pg10a-alias-picker-wave18-2026-10-01.png)。实际点击活动卡，进入其活动详情 `registrationSection`，`aliasLoadState=READY`、`canSetAlias=true`，`#aliasForm` 实际渲染；[昵称表单截图](images/caper-pg10a-alias-form-wave18-2026-10-01.png)。**没有填写或保存昵称。**

最后再次以成员 1 打开 PG08 反馈卡，确认 `outcomeLoadState=READY`、页面异常 0，并将模拟器留在这个未提交反馈的画面供人工检查：[最终开放画面](images/caper-pg08-feedback-open-wave18-2026-10-01.png)。服务端再次回读成员 1、成员 2 的 `myFeedbackSubmitted=false`、`independentFeedback=0`、结项级别仍为 `HOST_ONLY`。

本证据只覆盖测试 AppID、隔离 API 和模拟器中的上述按钮与界面。正式 AppID、HTTPS 域名、真机、订阅消息与真人活动仍需独立验收。PG08 初版截图中结项摘要的末尾数字折到下一行。

根智能体逐张查看本记录的 5 张截图后，确认 PG08 首图中“独立确认 0”的 `0` 孤立折行，原生 textarea 占高也使反馈卡明显比参考图稀疏。已在后续源码中将结项数字拆成不可分割的小段，并显式限定补充说明高度；**上述 5 张截图仍展示修正前画面**。

## 视觉修正后复核

将本地提交 `d650ff78b38a7e6800c8a11623b52eb7c728aae0` 再次同步到同一隔离项目；除本机 API 的 `config.js` 外，`diff -qr` 退出码 0。微信开发者工具 CLI `preview` 退出码 0，测试 AppID 不变，包体 **2,116,205 Byte**。定向脚本 `/private/tmp/project-irl-wave18-devtools/pg08-visual-recheck.cjs` 以合成 member-1 打开未提交的已结项反馈卡，`loadState=READY`、`outcomeLoadState=READY`，页面异常 **0**；[修正后截图](images/caper-pg08-feedback-visual-fix-wave18-2026-10-01.png)显示结项证据数字同排、补充说明框高度缩短、两个 CTA 完整可见。没有提交反馈。隔离 IDE 最后留在新版 PG08 卡供人工检查。原生 Computer Use 此次仍返回 Mac 锁屏，以上为 CLI／automator 模拟器证据，尚未完成同尺寸逐像素或真机验收。
