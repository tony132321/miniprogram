# 邀请卡服务器时钟失效收口（2026-10-01）

## 范围与行为

- 主办方 `GET /events/:id` 的 `inviteRemainingMs` 由数据库 `clock_timestamp()` 与 `invite_expires_at`、报名截止时间共同计算。任一时间已过、活动不招募或审核未通过时，响应不再携带 `inviteToken`。二次资格读取同时返回版本和口令，若与首次读取的活动快照不符，也隐藏旧口令。普通成员既没有口令，也没有该主办方专属字段。
- 邀请卡要求正数 `inviteRemainingMs` 才展示二维码和口令。旧响应缺字段时默认隐藏。发起 GET 前的本地时间仅用于保守扣除请求往返和安全状态读取耗时；设备绝对时钟不能单独赋予邀请资格。
- 活动详情的发布成功卡、主办工作台分享入口和原生分享回调也使用同一服务端剩余时长。页面开始重读时先停用旧邀请；响应成功后只在正数剩余时长内启用，计时到点自动收起。普通分享入口以 `share=1` 进入邀请卡，经再次核对后自动展示分享选择，最终微信分享仍须用户主动点击。
- 页面按较早的服务端剩余时长或本地报名截止时间收起口令、二维码和已准备的分享来源。复制前重新读取活动与安全状态，海报生成后再核对活动，准备原生分享仍由服务端 `share-intents` 核验；原生分享回调会再检查当前计时与账号身份。
- 既有审核、风险暂停、全局安全状态与身份切换防护保留。即时撤销可能发生在最后一次读取之后，接收方 `/i/:token` 与报名接口仍执行服务端鉴权；页面无法对离线或网络竞态提供“永远有效”的保证。

## 定向验证

- 新增后先运行红阶段：服务端主办方详情 1 项失败（缺少 `inviteRemainingMs`）；邀请卡 4 项失败（过期、旧响应、复制重查与已准备分享未收起）。随后添加的跨查询轮换口令竞态用例也先因旧口令仍出现在结果而失败。
- 绿阶段：`test/events.test.ts` 15/15；邀请卡基础用例初为 22/22，加入分享入口和离页竞态用例后 `test/miniprogram-caper-share.test.ts` 32/32；海报夹具补服务端有效期后 `test/miniprogram-caper-poster.test.ts` 7/7。`test/api.test.ts` 中邀请码和分享来源相关 2/2。TypeScript `tsc --noEmit` 通过，改动文件 `git diff --check` 通过。
- 活动页补充两个红绿用例：服务端有效期经过后旧发布卡不能再复制、准备分享或原生分享；旧响应缺少有效期字段时拒绝。`test/miniprogram-pg04s-published-shortcut.test.ts` 8/8；同页路由与入口两份文件合计 25/25。`test/miniprogram.test.ts` 的分享来源与返回刷新两项定向 2/2。当前隔离 API 从本地合成主办活动回读 `inviteRemainingMs` 为正数且与已审核招募状态一致；该合成服务不代表正式 HTTPS/真机验收。
- 未运行全量测试，未占用微信开发者工具，也未取得真机或正式域名证据。

## 文件

- `src/events.ts`
- `miniprogram/subpackages/activity/share/share.js`
- `test/events.test.ts`
- `test/miniprogram-caper-share.test.ts`
