# PG10-G 帮助页常见问题与发起入口定向证据（2026-10-01）

## 对照与变更

- 用户 ZIP `stitch_design_system_generator (2).zip` 的 `stitch_design_system_generator/pg10_g/screen.png` 和 `code.html` 将四条常见问题依次显示为“组局被爽约”“报名费 AA 争议”“活动无法成局退改”“申请认证主理人/局长”。此前小程序帮助页的后两条被替换为重大变更、联系主办方，页面首屏与参考稿不一致。
- `miniprogram/subpackages/profile/support/support.js` 恢复四个标题与排序，保留现有手风琴展开行为；答案按当前 R1 服务写明费用页只记录分摊、不处理付款或退款，主理人认证与等级尚未开放。没有沿用参考 HTML 中自动退款到账等尚无实现的承诺。
- 第四条展开后，`support.wxml` 显示“发起受控活动”按钮，`goCreate()` 进入现有 `/pages/create/create` Tab。它只提供真实的活动发起入口，不表示获得认证。原有违规举报和顶部路由保持可用。

## 定向验证

| 检查 | 结果 |
| --- | --- |
| 测试先行 | 新增 `test/miniprogram-pg10g-faq-routing.test.ts` 首次运行按预期失败，具体为四个常见问题标题与参考稿不一致。 |
| 聚焦回归 | `node --import tsx --test --test-concurrency=1 test/miniprogram-pg10g-faq-routing.test.ts test/miniprogram-caper-profile-info-routes.test.ts`：**8/8 通过**；验证四项顺序、真实能力边界、第四项展开及精确发起路由，并覆盖相邻个人页信息路由。 |
| 静态检查 | `node node_modules/typescript/bin/tsc --noEmit`、`node --check miniprogram/subpackages/profile/support/support.js`、`git diff --check` 均退出 0。 |

本轮未运行全量测试。后续在隔离微信开发者工具 CLI `preview` 成功后，合成账号打开帮助页，实际点击第四条 FAQ 展开，看到[四项问题和展开答案截图](images/caper-pg10g-faq-wave46-2026-10-01.png)；点击“发起受控活动”实际进入 `pages/create/create`，自动化异常 **0**。这是模拟器中的页面触控和路由证据，不是真机或全页逐像素验收。AI 客服、人工在线客服和普通反馈提交仍无 R1 服务接口，页面继续明确显示未开放。
