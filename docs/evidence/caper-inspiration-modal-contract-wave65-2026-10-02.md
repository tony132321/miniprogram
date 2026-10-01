# Wave 65：活动灵感原生弹窗参数契约修复

日期：2026-10-02。范围：仅首页／发现的活动灵感提示函数、一个必要的单文件契约回归及本证据。未修改 UI／字体／业务接口、共享矩阵；没有操作 Git 或微信工具；原生重验由 root 继续执行。

## 来源与原因

root 的 computer use 首页美食按钮实点没有出现预期提示，并指向两处相同 `wx.showModal` 参数。此次读取实际 WXML 绑定和完整对应函数：

- 首页类别 `openCategory`／灵感 `openInspiration` → `showInspirationAvailability`。
- 发现真实灵感卡绑定 → `openInspiration`。

两处 `confirmText` 原来都是 **`发起羽毛球`（5 字符）**。已读取 root 缓存的微信官方 api-typings 文件 `/private/tmp/caper-wave65-fonts/wechat-docs/lib.wx.api.d.ts:12165` 起的 `ShowModalOption`；`confirmText` 和 `cancelText` 均明确最多 4 个字符。原 `cancelText=继续浏览` 是 4 字符，满足契约。

该缓存文件为 1,633,209 B，SHA-256 `25e9e6fdab1b4282ee5231d8f8de7a31a177d2edc690ec834e0da479cc166245`；本次没有重新抓取或猜测其包版本。

原函数有 `success` 而没有 `fail`；本地既有测试的 showModal double 接受任意长度，因此能够直接调用 success 验证确认／取消，却不能发现原生参数拒绝。此次用参数边界和失败路径回归捕获这一缺口。root 的实点是发现依据，本次本地测试不替代其最终原生确认。

## 最小修改

只改两处相同的 modal 配置块：

1. 确认按钮文案改为 **`去发起`（3 字符）**。
2. 添加箭头 `fail`，保留页面 `this`，将原 `notice` 写入现有 `availabilityMessage`。两页已有相应 `wx:if` 可见提示块，API 失败时能力说明仍能呈现。

原说明“目前仅供灵感参考／当前只能发起羽毛球”活动能力保持；取消不跳转，确认仍调用实际 `goCreate`，目标仍为 `/pages/create/create`。没有 API 时的原页面 fallback 保持，没有新增假报名、自动发布或其他活动类型接口。

## 测试：先红再绿，仅此单文件

命令完整如下，红／绿各执行一次：

```sh
/Users/tsb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --import tsx --test --test-isolation=none --test-concurrency=1 test/miniprogram-inspiration-modal-contract.test.ts
```

测试使用 VM 加载真实 Page 源码，由当前 WXML 的 `bindtap` 获取实际入口函数；微信 UI 是外部边界，使用参数／回调 double，没有改写页面 `goCreate`。三入口分别为首页“美食”类别、首页“周末聚餐”灵感卡和发现“咖啡聊天会”主卡。

每个入口覆盖 5 项：原生 confirm／cancel 字符限制与真实能力说明、取消不导航、确认进入既有 create Tab、API fail 写准确可见说明且不导航、API 不可用时保留同说明。

| 执行 | 结果 | 退出码 | 观察 |
| --- | --- | --- | --- |
| RED，修改前 | 15 项，9 通过／6 失败 | 1 | 三入口各失败两项：`confirmText "发起羽毛球" exceeds the native four-character contract`、`API failure must reach the page instead of silently disappearing`；是预期生产缺陷，没有 harness 异常 |
| GREEN，最小修改后 | **15／15 通过，0 失败、0 跳过、0 取消** | 0 | 参数契约、取消／确认分支、箭头 fail 的页面 this、真实 notice 与现有可见绑定、API 缺失 fallback 全通过 |

测试中原生 fail 的“可见”证据是准确页面状态加实际 WXML 条件／内容绑定，不是原生弹窗截图。本次没有跑其他测试文件、全量、CI、微信编译、真机或外部资源验收。

## 字节范围证明与 freeze

两个产品文件中新的配置块各出现一次。将这个唯一配置块逆替换为原文后，两个 SHA-256 均准确还原修改前值，因此除该块外的 JS 字节未变；没有依靠宽泛重写或更换页面实现。

| 文件 | 修改前 SHA-256 | freeze 字节／SHA-256 |
| --- | --- | --- |
| `miniprogram/pages/index/index.js` | `c0e7f279fab82c31311f5ae4de6984d9631f47cb7486468d1ebe77896d082b88` | 32,598 B；`d85b9db816163c4853bd2a7a9abec66dc62e8047d9e79c19457f4cb57dc8ac11` |
| `miniprogram/pages/discover/discover.js` | `9644a52f186b3f5ce3b99389849571f8a8110c3a3045c70f383ee407c7c9592a` | 17,758 B；`928b72be56fca9c7cd4d2a8fd8f76d14632ef9c315dbfb2ea62c97a9c81712b5` |
| `test/miniprogram-inspiration-modal-contract.test.ts` | 新增 | 6,155 B；`435a94fc6fdbc33311e5c628978d229b4da5bb801b49a9eba7e8461fe4a83a62` |

后续 root 只需同步这两 JS 的 frozen 版本，重试原生首页美食／发现灵感按钮，记录弹窗、取消留页、确认发起目的地；若还有实际失败再按新证据处理。此证据仅证明本次两个配置块的本地契约修复，不宣称全项目或 39 屏 UI 验收完成。
