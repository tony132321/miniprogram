# Wave 57 定向微信工具与会话复核（2026-10-01）

## 本轮范围

在本机候选 `f17364a94f8bd968026b37254ba61e930f05be37` 之上，修复 PG10-C 旧会话缓存分类重显、补充 RQ14 AA 尾差事前说明，以及修复 PostgreSQL 事实来源竞态脚本的过时 SQL 匹配。分项红绿证据见 [PG10-C](caper-pg10c-filter-session-wave57-2026-10-01.md)、[RQ14](rq14-aa-remainder-disclosure-wave57-2026-10-01.md)、[PG 来源锁](pg-ai-source-race-query-match-wave57-2026-10-01.md)。复用既有页面、接口和分摊算法。

完整小程序同步到隔离工程 `/private/tmp/irl-pg05s-final-20261001/miniprogram/`，排除本地 `config.js` 与 `.DS_Store` 后 `diff -qr` 退出 0。测试 AppID `wxbbcab69099026d3f`，本地合成 API `http://127.0.0.1:3037`，微信开发者工具 Automator `9536`，基础库 `3.17.2`。本轮 `Tool.getInfo` 和 `connect` 已响应；Wave 56 的初始化失败是当时状态，不能据其断言本轮仍阻塞。

## 模拟器实际点击与回读

| 场景 | 结果与边界 |
| --- | --- |
| 发起 IDEA→手动 FORM→本周六→本周日 | 实际点击并等待页面状态变更，开始日从 `2026-10-03` 变为 `2026-10-04`，结束日同步为 `2026-10-04`。[日期区截图](images/caper-create-quick-date-wave56-2026-10-01.png)已定位 `#form-schedule` 后复拍。没有生成草稿、保存、发布或点击原生日历。 |
| `_1` 行程自然日与个人按钮 | 当前合成身份首卡活动 `02c295b8-10e0-4602-8d25-1dc0d801a5f1` 按上海自然日回读为“明天开始”；以日期格式化独立计算相差 1 天。白色个人图标实际点击进入 `pages/me/me`。[当前行程截图](images/caper-itinerary-current-wave56-2026-10-01.png)。只覆盖首卡，不覆盖所有后续卡和日期边界。 |
| PG11-C 关闭态→PG10-C→返回 | 消息页实点最近会话，得到 `CHAT_UNAVAILABLE`；“查看我的活动”进入 `moments?filter=all`，当前合成身份读取到 3 个真实活动 ID；返回得到 `INBOX`／`ALL`。[关闭态截图](images/caper-pg11c-chat-route-2026-10-01.png)、[本人记录截图](images/caper-pg10c-from-chat-2026-10-01.png)。私聊能力仍关闭。 |
| PG11-C 旧会话跳转 | 留在关闭态替换合成 `devUser` 后点击原活动入口，未发生导航，清空关闭态并提示“账号已切换，请返回后重新加载消息。”。这是存储身份变化分支，同用户 token 轮换由定向测试覆盖。 |
| PG10-C 旧会话分类 | 留在本人记录页点击参与分类，替换合成 `devUser` 后实点主办分类。当前 route 不变，`events=[]`、`visibleEvents=[]`、`activeFilter=all`、`loadState=ERROR`，显示账号切换说明。[旧卡清空截图](images/caper-pg10c-stale-filter-wave57-2026-10-01.png)。恢复身份重新加载后，拼贴按钮正常进入同 ID `02c295b8-10e0-4602-8d25-1dc0d801a5f1` 的 `READY` 详情。 |
| RQ14 操作前说明及账本 | 合成主办 `caper-pg09-art-muoljo3y-host` 打开活动 `d9fe2434-1260-4cae-b921-27238e7a7956` 的主办分区，记录／修订按钮前实际渲染固定成员顺序、每名尾差成员加 `0.01 元` 和份额总和规则。[说明截图](images/caper-rq14-aa-before-record-wave57-2026-10-01.png)。同场费用分区当前账本回读总额 `10001` 分，份额为 `[2501,2500,2500,2500]`，合计一致。本轮没有新增或修订账本，也没有付款动作。 |

本轮三段脚本均退出 0、捕获页面异常为 **0**。脚本留在 `/private/tmp/project-irl-automator/caper-wave56-form-itinerary.cjs`、`caper-pg11c-pg10c-route-20261001.cjs` 和 `caper-wave57-focused.cjs`。最后恢复原合成身份 `caper-r1-actor-20260930`，打开活动 `97ed8055-27fb-484e-87a2-9986805fcae1` 并临时显示 `JOINED` 成功卡供检查；该显示状态不是本轮新报名证据。没有确认 native IDE 前台窗口状态。

## CLI 与定向代码证据

微信 CLI `preview --project /private/tmp/irl-pg05s-final-20261001 --port 21467` 退出 **0**：总包 **2,000,580 B**、主包 **1,794,924 B**、活动分包 **60,293 B**、个人分包 **145,363 B**。信息文件 `/private/tmp/caper-wave57-preview-info.json`；预览不代表真机或正式 AppID 合法域名已验。

PG10-C 相关三文件 **32/32**，独立会话复核 **5/5**；现有整数分 AA 用例 **1/1**；本机新建空 PostgreSQL 数据库的来源竞态脚本五个场景通过。各子任务类型、语法和差异检查通过，详见分项记录。整合后根代理再核五条邀请／通知失败场景通过、主办封面两条用例通过；全局 `pnpm typecheck`、`git diff --check`、凭证扫描退出 0。按用户要求没有运行本机全量测试或重跑远端全量 CI。

## 尚未通过的范围

旧远端 [R1 CI #110](https://github.com/tony132321/miniprogram/actions/runs/36828857509) 是修复前 tree：来源竞态失败已定位并在本机修复；常规 `checks` 的 6 项失败均为旧 fixture 或结构断言与现有门槛不一致，已逐项红绿验证并保留产品保护。详见[邀请两项](ci-invite-fixture-alignment-wave57-2026-10-01.md)、[邀请与通知三项](ci-miniprogram-notice-invite-fixtures-wave57-2026-10-01.md)和[主办封面结构](pg02c-host-cover-test-binding-wave57-2026-10-01.md)。旧 run 仍为失败；本轮提交使用 `[skip ci]` 避免再次自动跑全量，不能标为修复后远端 CI 通过。

这些证据仅覆盖表中页面和分支，不构成 39 屏同尺寸逐像素验收、全部按钮或全部角色的完工结论。正式 AppID、HTTPS 合法域名、订阅模板／送达、真机、真人值守和三场受控活动仍待外部资源。
