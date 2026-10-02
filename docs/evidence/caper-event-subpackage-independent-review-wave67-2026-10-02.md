# Wave 67 — 活动页分包迁移独立只读审查

日期：2026-10-02。审查者：`/root/ui64_review`。基线：`a8486175a3bfb3a70f475725b4901d1cf9de603b`。

**结论：最终迁移的文件、依赖路径、页面注册、旧入口兼容和测试 fixture 改动未发现仍阻断本批的源码缺陷。** 本次未运行入口测试、七个指定迁移业务文件、SDK、微信 CLI、全量或 CI；不据此声明原生导航、分享、包体或业务验收通过。产品和他人证据未修改，仅写本独占报告与 `/private/tmp/caper-wave67-form-event-review/subpackage-check/`。

## 1. 完整迁移文件与依赖路径

root 在迁移前冻结完整 event 目录的 39 个文件，清单 `/private/tmp/caper-wave67-event-root-freeze/manifest.json`，SHA256 `f16a883b4b6d3ad74d5ffbb46d5d0992c915cd09077eb15648121e5121afd185`。这包括 35 个 SVG 和 `.js` / `.json` / `.wxml` / `.wxss` 四个产品文件。独立审查直接比较每个最终 `miniprogram/subpackages/activity/event/` 文件和该清单，不使用旧 canonical stub 代替冻结产品。

- 新目录文件集合与清单完全相同，既无少文件，也无额外混入的来源 JSON、HTML、PNG、字体档案。
- 38 个非 JS 文件 bytes / SHA256 完全不变，包含 C 最终 WXML / WXSS、PG01 与 PG05 / PG05-S 全部 SVG、原 custom navigation JSON。
- event.js 唯一变化是五个 `require('../../...')` → `require('../../../...')`：`utils/api.js`、`utils/checkin-qr.js`、`config.js`、两处 `utils/sha256.js`。每个增加三个路径字符，总净 +15 B。
- 将这五个新增父目录层级精确逆除后，完整 JS 104,032 B 与原冻结哈希 `7aba63388c13daae75f2485cf31bea5ab0bd7db1a1568e293a03b31240fd7605` 完全相同。五个实际目标均仍指向 main 中既有文件，不指到另一分包或不存在的重复库。
- 43 次静态 image 引用均从迁移后的相对目录或原绝对 main 路径解析成功；无遗留 `/pages/event/assets` 产品引用。相对 `./assets/` 不需要改写图片字节或 WXML。

| 最终迁移产品 | Bytes | SHA256 |
|---|---:|---|
| `subpackages/activity/event/event.js` | 104,047 | `ccb5b5fede066ba0533b82cb564e816cc3d45ca96778a0d25ac5286d3c11a4bd` |
| `subpackages/activity/event/event.wxml` | 100,072 | `c2dd55c68a3123d9969c204df0d1e91ccca69e53dda4ae5c921a12041eeb9720` |
| `subpackages/activity/event/event.wxss` | 120,006 | `94049293bebaf3889760403fb43de4b0a3710f82de40d3d0655e54ef5074e6af` |
| `subpackages/activity/event/event.json` | 69 | `bf33dc7da099d240642a50fe3cf44cee01a2b282f70a80a313c79317c76ad10b` |

以上路径均相对 `miniprogram/`。完整原目录 raw 总字节 335,826，迁移后 335,841。没有以删除原图形、重编码照片、替换字体或删减业务来换包体。

独立结果：`/private/tmp/caper-wave67-form-event-review/subpackage-check/independent-migration-check.json`，SHA256 `2b4f5f0f875ef830681638f2c3deb84ff27539ce9d3f4c50c33625ffbe80a280`。这是只读文件 / 配置 / fixture 核验，不是执行测试。

## 2. 页面注册和 canonical 入口

`app.json` 只有 activity 分包 pages 数组追加 `event/event`；独立移除该项后整个解析后的配置与基线相等。总路由 20 → 21，没有重复；原 20 条、五个 Tab、window 配置全部保持。21 个路由四件套都存在。

旧 `/pages/event/event` 仍注册，用于已有首页、消息、个人页、行程、分享卡、通知和后端 deep link 的稳定目标。它现在只注册真实入口 factory：

```js
const { createEventEntryPage } = require('../../utils/event-entry.js');
Page(createEventEntryPage(wx, getCurrentPages));
```

旧页不复制活动 API、身份、名单、报名或内容数据逻辑；WXML 仅显示加载态，失败显示现有 `retry` / `goBack` 两个真实方法。旧页已不保留原 custom navigation 假定，而迁移后的活动产品保留 custom navigation。正常目标由 helper 固定为 `/subpackages/activity/event/event`，使用 redirect，不引入另一个可由 query 指定的任意目标。

| 入口 / 配置最终文件 | Bytes | SHA256 |
|---|---:|---|
| `miniprogram/app.json` | 1,255 | `d8bbcd19830fd03f9cec0117cbbeddf0cdd60e49693508d4fba41696b6e4e72b` |
| `miniprogram/pages/event/event.js` | 121 | `7794d28eb295a45de9b2015ed80747a0d22e34a0e00874636f0972e3106513d7` |
| `miniprogram/pages/event/event.json` | 42 | `42a1a3bf4a4ae9f6f9e6e22182aaaeefeeec899b668d1b81e30eaf3ad958e01c` |
| `miniprogram/pages/event/event.wxml` | 345 | `7c22ffdf7bb255cd8e9dae6399e465129b65384be4dca2e3bb8b3ea7d5280ac3` |
| `miniprogram/pages/event/event.wxss` | 223 | `c05050373a172881009c76f37f54ec1830b1aa39f99ca4cfd806d5dde01e182e` |
| `miniprogram/utils/event-entry.js` | 1,893 | `3d15c741d34ff35c4e071b7478db13b4c6e70ed1a20616689389a4647be89d05` |

这里检查了 helper 的动态目标确已注册。现有 binding-routes 测试扫描的是页面 source 的 `wx.*({url:literal})`，不会自动覆盖 helper 的 `wxApi.redirectTo({url:this._target})`；不能用其 literal route 数量替代本项独立核对。

## 3. 最终入口编码、隐私和导航生命周期

root 原生 SDK 调试报告旧 canonical 跨 hop 将已有 `%HH` 再编码，最终 `data.source` 出现 `Wave%252067…`。本审查先暂停对旧 helper 的冻结结论，待 root 修正后只审最终 `3d15c741…`；未擅自在活动业务页 decode query。

最终明确契约是保留微信该入口已有 URL wire escapes，同时安全编码尚未编码的字符：

```js
return encodeURIComponent(String(value)).replace(/%25([0-9a-f]{2})/gi, '%$1');
```

- keys 和 primitive values 使用同一 helper；仅 string / number / boolean 被转发，object / function 不被序列化进 URL。
- 先完整 `encodeURIComponent`，再一次非递归恢复有效的既有 `%HH`。原始 `&`、`=`、`?`、`#` 等仍保持百分号编码；原始 `%`、`%z3` 等不是两个合法 hex 的片段不会被直接放行。已 wire 编码的 `%25` 不递归解成 query delimiter。
- 这个规则以当前 canonical 的 onLoad wire 契约为依据；没有声称任意外部 raw 字符串中的合法 `%HH` 都代表字面百分号，也没有在业务对象里进行额外解码。
- `id` / `token` / `source` / `section` / `entry` / `success` / empty 原入口参数均随 query 转发；固定 path 不接受任意目的路由。
- query 只存在私有 `_target`，不写 data；失败文案不采用平台 errMsg 或 exception text，不泄露 token / source。同步 navigation throw 与异步 fail 都进入同一可重试状态。
- `_navigating` 阻止加载中连续 retry；单调 `_request` 和 `_active` 过滤旧失败、卸载后失败和 retry。onUnload 清空 `_target` 并使请求过期。
- 有 stack 时返回一层，失败 fallback 首页；直接 launch fallback 首页。fallback / unloaded 状态均检查 `_active`，保持原入口返回意图。实际平台返回栈仍由 root runtime 证明。

root 报告更新后入口单文件 7 / 7 通过，包括已编码 source / token / id 的跨 hop 回归。本审查只阅读测试及 source，**没有重跑**。最终 `test/event-entry.test.ts` 4,610 B，SHA256 `bdc643554f63233e9235aad3b368e8a0c3ca8d44f5b5bee352928ce9c4c81e20`；旧失败、retry、stale、unload 和返回用例仍保留。

## 4. 二十一份 fixture 与 binding-routes 适配

对以下 21 个既有文件逐一将 source / markup URL 路径迁移逆除，再将 `path === '../../...' || path === '../../../...'` 兼容判断逆除，完整文本与 Git 基线 `a8486175a3bfb3a70f475725b4901d1cf9de603b` 相等。使用 Git 只读 `diff` / `show`，没有提交或其他 mutation。

```text
event-caper-navigation.test.ts
invite-miniapp-refresh.test.ts
invite-miniapp-share.test.ts
miniprogram-caper-poster.test.ts
miniprogram-event-action-identity.test.ts
miniprogram-event-controls.test.ts
miniprogram-event-expense-interactions.test.ts
miniprogram-event-live-detail-layout.test.ts
miniprogram-event-post-refresh-race.test.ts
miniprogram-event-resilient-detail.test.ts
miniprogram-event-safety-clipboard-race.test.ts
miniprogram-event-screen-navigation.test.ts
miniprogram-event-session-isolation.test.ts
miniprogram-event-time-controls.test.ts
miniprogram-host-completion-shortcut.test.ts
miniprogram-outcome-notice-deeplink.test.ts
miniprogram-pg04s-published-shortcut.test.ts
miniprogram-pg06-host-announcement-shortcut.test.ts
miniprogram-pg09-expense-share.test.ts
miniprogram.test.ts
pg05-confirmation.test.ts
```

文件都在 `test/`。259 处 old / new 相对 require 兼容替换同时允许普通 main harness 的旧路径与新活动 harness 的三层路径；没有改变 mock 返回对象、身份、时序、行为断言、预期 canonical 导航地址、数量或授权条件。原 canonical URL 的 route 断言继续保留，符合仍注册旧入口的兼容设计。

`test/miniprogram-binding-routes.test.ts` 独立四处必要增量逆除后也与基线全字节相等：

1. 引入 `createRequire`。
2. 定义 `requireModule = createRequire(import.meta.url)`。
3. 对 `utils/event-entry.js` 精确返回真实 helper，避免此前 generic Proxy 把 factory 返回值伪装成无效 page；其他 require mock 顺序和行为保持。
4. 为 canonical page factory 提供 `getCurrentPages() { return []; }`，只完成 Page 注册所需上下文，不执行 onLoad。

原所有 binding / route 断言保持，未排除新分包或旧 stub；最终该测试文件 2,569 B，SHA256 `f92a355bad50dd13f83b6216c21e5a715abb035dce39826e76c2ec9167d6eda4`。本报告未重新运行这个 VM / 测试，不能由 source 逆还原推定全套未执行测试的结果。

## 5. root 限定 REVIEW 滚动修正

root SDK 实际发现从较低 FORM 进入 REVIEW 时保留旧滚动位置，顶部 banner 被隐藏。最终 create.js 只在普通新 draft publish 的最后 `setEditorData` 加原生回调 `() => wx.pageScrollTo?.({ scrollTop: 0, duration: 0 })`。

该回调在原身份 / generation 检查和真实 saveDraft 之后，只在 stage / publishPreview / reviewSummary 已写入的 setData callback 执行；`setEditorData(patch, callback)` 原来就将 callback 传入 setData。编辑已发布活动的 changePreview 分支提前 return，IDEA、API、payload、字段、真实发布调用均无新增逻辑。

独立逆除唯一 scroll callback 后 create.js 完整恢复 B 最终冻结 SHA256 `756912f00f8fbf590461d644041b9dac151e1783e630c68f335ad9cbc3bdb3e5`；当前最终 root JS SHA256 `daaf623cbc29a562f41c58dfb4d9cb8ceebcd062456066439d835ddd68bdd18f`。create.wxml / .wxss 仍分别是 B 最终 `1f43b903…` / `5daf6627…` 字节，未因修正重新设计 UI。没有新增样式镜像测试；实际 banner 位置由 root 再次限定 native 核验。

## 6. 边界和交接

源审查确认迁移完整、旧 canonical 接通新固定路由，保护真正活动页业务及所有本批来源图形。main 仅保留 731 B canonical 四文件和 1,893 B helper；这里的 raw 文件数不能替代 CLI 主 / 分包实测。

root 独占最终编译、包体、SDK 跨 hop 参数、native 返回、真实报名回读以及受影响按钮实点。本报告没有重跑已通过入口单文件和七个指定迁移业务文件，没有全量测试或浏览器运行，没有把 source PASS 扩展到真机、真实服务、订阅或受控活动验收。
