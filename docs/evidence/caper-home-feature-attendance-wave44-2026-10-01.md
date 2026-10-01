# 首页主活动卡确认人数行（2026-10-01）

用户设计包 `stitch_design_system_generator (2).zip` 的 `stitch_design_system_generator/caper_2/screen.png` 与 `code.html` 在主羽球卡时间、地点下面放一行人数信息，示例为人物头像与“16人已报名”。原小程序 `pages/index/index` 主卡在该位置直接显示“配图仅作示意／查看详情”，缺少人数层次。

本轮只补这一处：首页主办活动的主卡，从同场受权 `GET /events/:id` 回读 `stats.confirmed` 与 `payload.maxParticipants`，显示“已确认 X / 上限 Y 人”。详情必须同时满足当前账号、同场 ID、主办 ID、审核通过、状态一致、详情版本和有效整数；列表提供版本时详情不得回退。详情失败时保留原卡并隐藏人数。待审、普通成员以及权限或字段不明的卡保持列表原状，不因此增加成员默认首页的详情请求。左侧用中性装饰圆点还原参考图的人数行节奏，没有照搬虚构头像或“已报名”口径。整张主卡仍是一个按钮，点击进入同场详情。

隔离微信开发者工具实点发现真实 `/me/events` 主办摘要有 `isHost=true`、`status=IN_PROGRESS`，却省略 `reviewStatus`、`version`、`stats`，原先的列表预检阻止了详情 GET，人数仍为空。现在列表仅以当前主办身份和显式审核/版本字段做预检；这两个字段缺省时允许同场详情回读，最终人数仍须通过上述详情事实校验。显式待审、非法版本、详情异常或过期响应继续隐藏人数。

## 定向验证

- 新增 `test/miniprogram-caper-home-feature-attendance.test.ts`。真实摘要缺省审核与版本的回归在修复前因没有详情 GET 先红，修复后该文件 **4/4**；联合本批首页定向用例 **38/38**，类型检查、JS 语法检查与 `git diff --check` 通过。
- 待审主办、成员、字符串人数、主办 ID 不匹配、旧版本与详情异常均不展示确证人数；详情异常仍保留首页 `READY` 主卡。账号切换后的迟到响应不能恢复旧人数。
- 按本批范围未运行全量测试。修复后在隔离微信开发者工具以合成主办账号 `caper-pg09-art-muoljo3y-host` 重开首页，实际 `/me/events` 摘要省略审核和版本，仍回读同场详情；主卡数据和渲染文本均为“已确认 4 / 上限 6 人”，自动化异常 **0**。[修复后首页截图](images/caper-home-feature-attendance-wave45-2026-10-01.png)。CLI `preview` 成功，脚本 `/private/tmp/project-irl-automator/home-profile-wave44-smoke.cjs` 的默认路径通过。合成数据模拟器证据不作为整屏逐像素 1:1 或真机验收。
