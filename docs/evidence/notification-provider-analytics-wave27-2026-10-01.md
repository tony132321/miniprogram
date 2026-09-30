# T31 通知提供方接受事件定向证据（2026-10-01）

## 范围与复用

开发包 `ops/metrics.json` 将 `notification_provider_accepted` 列为服务端事件，并要求 UUID、时间、用户伪名、活动、版本、来源、发布线及测试标记，禁止敏感全文。既有第 66 版 `system_business_events` 刻意只有事件名、时间和可空测试标记，承载跨活动聚合及无活动流程，不具备活动级去重字段。第 69 版迁移保留其结构及触发器，复用 `business_events` 九字段、库内身份盐、私有审计和现有通知状态转移。

仅在 `DISPATCHING → PROVIDER_ACCEPTED` 或 `UNKNOWN_REQUIRES_RECONCILIATION → PROVIDER_ACCEPTED`，并且状态行具有非空提供方回执和本次新增的响应时间时，同事务新增一次 `NOTIFICATION_PROVIDER_ACCEPTED`。私有通知 ID→随机事件 UUID 映射以通知 ID 作唯一键，用户伪名盐轮换后不重复计数；本人字段盘点包含该映射。分析行不保存通知 ID、原始用户 ID、回执、消息内容、token、手机号、照片或坐标。伪名对应收件人；版本取通知创建时绑定的 `event_version`，即使活动后来修订；来源按自动发送 `JOB` / 运营复查 `OPS` 区分；发布线 `R1`、测试标记取服务端活动。私有审计只保留收件人作为 actor、活动和动作名，使收件人个人导出可以关联自己的事件，detail 为空。事件表示提供方明确接受，**不表示用户收到或已读**。

## 可复核结果

- 先添加行为断言，运行 `node --import tsx --test --test-name-pattern='external dispatch events distinguish' test/system-business-events.test.ts`：退出码 1，直接接受与复查接受应各有一条，实际 0 条。失败定位到原有聚合事件缺少活动级成功记录。
- 加入第 69 版迁移后运行 `node --import tsx --test test/system-business-events.test.ts`：**4/4 通过**。合成提供方适配器覆盖直接接受、拒绝、未知后复查接受、相同复查键重放、受理任务重放、回滚、撤销同意和待删除请求的发送屏障；未发送的适配器没有被调用，且没有活动级成功事件。活动修订后复查仍使用原通知版本。受理事件只有九个白名单字段、两个不同收件人伪名；拒绝、未知、未发送均未进入成功事件。无活动范围通知只进入既有聚合流，不触发活动级事件，也不会使接受状态回滚。收件人个人导出可读取自己的事件。
- 运行 `node --import tsx --test --test-name-pattern='notification provider acceptance migration' test/db-migration.test.ts`：**1/1 通过**。模拟旧库已有接受状态及聚合事件，升级至第 69 版不回填；旧行仅切换状态而没有新提供方响应时间，也不产生新成功事件。新受理才新增活动级事件，使用原通知版本和服务端 `is_test=false`。
- 独立只读审查发现原方案在用户伪名盐轮换后会重复计数，且无活动通知会回滚提供方接受状态。已将去重改为私有通知映射，增加盐轮换后的重复接受回归；无活动范围提前跳过活动级写入。`node --import tsx --test test/privacy-field-inventory.test.ts`：**4/4 通过**，本人字段盘点仅统计当前收件人的私有映射。
- `./node_modules/.bin/tsc --noEmit` 与 `git diff --check` 均退出码 0。上述命令以工作区 bundled Node 路径执行；没有运行全量测试。

本证据是 PGlite 和合成提供方契约验证。尚未在独立 PostgreSQL、真实微信订阅消息提供方、正式 AppID、真机或目标分析系统验证；旧接受记录不伪造活动级事件。既有聚合流仍用于跨流程计数，分析时不得与活动级流相加。
