# RQ19：活动审核版本与内容来源二次挡板（2026-10-01）

## 复现与边界

在隔离 PGlite 中，成员已加入审核通过的邀请活动 v2。主办把场馆改为 v3，活动版本未获审核，但 v3 公告单独通过内容审核；随后主办再改为 v4 并由运营审核 v4。修复前成员在 v4 审核前看不到 v3 公告，v4 获批后却重新看到从未获活动版本审核的 v3 场馆文字。跨版本回归先以 `true !== false` 失败。

另一条受控复现沿用第 48 版迁移中的“既有报名成员，但尚无任何已审核活动版本”场景：活动详情仅显示“活动审核中”，且内容列表隐藏待审版本公告；主办编写的 FAQ 公告在内容审核通过后，直接事实问答仍返回待审场馆，AI 上下文也含 FAQ 全文。新增回归先以 `1 !== 0` 失败。这里的报名记录用测试夹具直接插入，以覆盖迁移前既有成员；正常新报名仍由审核闸门阻断。

独立复核又发现同版本迁移边界：第 48 版前已发布的 INVITE v2 可作为成员可信旧版，升级后活动 v2 进入待审但版本号未变。若迁移后仍在 v2 新建公告或成员问题与主办回答，并单独完成内容审核，旧查询只看活动快照的 `created_at`，会把这些新内容当作迁移前内容放行。隔离回归覆盖旧 FAQ、迁移后 FAQ、QUESTION、ANSWER、直接问答、AI 上下文、两类事实来源的直接与语义旧键重放，以及供应商返回前来源时间变化；修复前列表断言以 `true !== false` 失败。恶意测试供应商强指向隐藏 FAQ ID 时，成员上下文仅含旧 FAQ ID，最终返回安全 UNKNOWN。

最终审阅还确认一个时间边界：原始 `activity_content.created_at DEFAULT now()` 取事务**开始**时间。若旧事务在审核迁移时间前启动、迁移时间后才写内容，即使 SQL 要求内容早于第 48 版，时间戳仍可能落在边界以前。新增第 70 版迁移把该列默认改为 `clock_timestamp()`；现有第 1 版 `schema.sql` 和第 48 版脚本均未改动校验和。迁移回归模拟旧库恢复 `now()` 默认并重跑新迁移，在一个事务中记录开始时间、等到后续边界、再插入内容：修复前插入时间不晚于边界，修复后晚于边界。

## 修正

`reviewedContentSourceVersion` 明确区分：字段未出现代表当前版本可读，数字代表已审核旧版，`null` 代表没有可信文本来源。普通内容除自身审核状态外，还需所属活动版本获得审核批准；迁移前邀请版本只有其**内容本身也早于第 48 版迁移**时才沿用历史可信豁免。统一 SQL 来源判定应用于成员内容列表、ANNOUNCEMENT 与 ANSWER 事实读取、AI 上下文和语义问答各次来源重读。主办、作者本人及现有固定安全系统公告保留原有可见性。迁移后同版新内容在该活动版本获运营批准后恢复可见。

事实问答与 AI 上下文在无可信来源时不读取公告或回答；事实问答返回安全未知答复，成员自己的问题待办仍可创建。语义问答在候选校验、同键重放和最终持久化时均复核可信版本；旧二进制已缓存的待审 FAQ 回答同键重放被拒绝。活动版本随后通过审核时，内容列表及问答再次按审核后的版本开放。

## 定向验证

- `node --import tsx --test --test-concurrency=1 --test-name-pattern='skipped unreviewed|no trusted event' test/collaboration.test.ts`：新增两条回归 **2/2** 通过，均在修正前失败。
- `node --import tsx --test --test-concurrency=1 --test-name-pattern='legacy invitation version exposes only' test/collaboration.test.ts`：同版本迁移漏洞新增回归先失败；补齐隐藏 FAQ 的直接/语义旧键重放与供应商假候选后重新通过 **1/1**。迁移前可信历史断言与其先前合跑 **2/2** 通过。
- `node --import tsx --test --test-concurrency=1 test/collaboration.test.ts test/invite-moderation.test.ts test/ai-semantic-answer.test.ts`：修正后相邻定向 **45/45** 通过。
- `node --import tsx --test --test-concurrency=1 --test-name-pattern='content creation time uses|schema migration is recorded once' test/db-migration.test.ts`：第 70 版升级及跨事务时间边界回归先失败，修正后与既有迁移校验和回归合跑 **2/2** 通过；迁移前可信历史及同版内容回归另合跑 **2/2**。
- `tsc --noEmit` 与相关文件 `git diff --check` 通过。

未运行全量测试、CI、正式 PostgreSQL 或真机验收。若数据库从第 48 版以前一次升至第 70 版，`createProductionDatabase()` 在同一 `BEGIN` / `COMMIT` 中顺序执行全部待补迁移，默认值变更与审核迁移原子提交；若旧事务被迁移挡住、在迁移提交后才执行 INSERT，将使用新默认。已在第 48 至第 69 版运行过的在线库，升级第 70 版以前仍可能有旧默认造成的时间歧义，且新迁移不会可靠重建其真实插入时间；部署时需暂停协作内容写入、排查可疑历史内容并在完成第 70 版后恢复。外部手写 `created_at` 和非标准迁移流程不在本地证明范围。迁移 16 前 `event_version=NULL` 的历史内容无法可靠归属某个已审核活动版本，在待审窗口继续保守隐藏；上述验证只证明带可信版本和迁移前写入时间的历史内容可见。当前系统公告例外仅对现有 `changeEvent` 固定安全文字适用；将来若增加系统公告写入来源，需重新审查该例外。
