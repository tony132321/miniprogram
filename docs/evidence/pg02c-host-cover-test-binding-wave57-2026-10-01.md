# PG02-C 主办封面状态测试绑定修正（2026-10-01）

## 原因与依据

候选 `f17364a94f8bd968026b37254ba61e930f05be37` 的 `test/miniprogram-caper-pg02c-host-cover.test.ts` 本机定向复现为 **1/2** 通过。失败发生在原第 61 行：整段 WXML 正则要求 `cover-status-progress` 条件 class 绑定之后立即结束 class 属性。

提交 `9074e5d` 为共用卡片状态胶囊增加了 `history-cover-status-{{item.historyTone}}`，用于历史取消／过期的中性样式。当前 `miniprogram/pages/index/index.wxml` 仍在同一胶囊使用 `item.coverStatusLabel ? 'cover-status-progress' : ''` 和 `item.coverStatusLabel || item.cardLabel`，数据映射与真实招募缺口计算也仍存在；旧断言把附加样式误判为状态能力丢失。

独立核对原 ZIP 按页解出的 `pg02_c/screen.png` 和 `code.html`（本机路径 `/private/tmp/irl-wave57-reference/stitch_design_system_generator/pg02_c/`）。原 HTML 第 73 行是“招募中 · 还差2人成局”，第 153 行是“已满员 · 8/8人”，第 215 行是“管理活动”。另查看既有 [Wave45 卡片截图](images/caper-pg02c-manage-wave45-2026-10-01.png)：真实合成进行中卡显示真实状态及“管理活动”；[既有实点记录](caper-pg02c-organizer-cover-wave45-2026-10-01.md)记录同 ID 主办区回读。该旧截图不能替代本批新模拟器验收。

## 改动

仅修改现有测试：先提取真正的 `cover-status` 元素，再分别断言其进度 class 条件绑定和同一元素的真实状态 fallback 文本。允许 class 属性中增加其他样式，仍拒绝进度绑定缺失、状态绑定缺失或被硬编码。

原先的已审核缺口 2 人、待审／人数未知／截止时不能宣称缺口，以及“管理活动”同场 `hostSection` 路由断言全部保留。正例另明确验证两卡属于主办分类，以及已成局卡不显示招募缺口、fallback 为“已成局”。正则捕获组在使用前明确验证为字符串，满足严格 TypeScript 检查。

未修改首页 WXML、样式、JavaScript 或其他产品行为；没有新增测试文件。

## 验证

只运行指定测试文件：

```sh
/Users/tsb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --import tsx --test --test-isolation=none --test-concurrency=1 test/miniprogram-caper-pg02c-host-cover.test.ts
```

修正后退出码 **0**，**2/2** 通过，失败 **0**。另执行：

```sh
PATH=/Users/tsb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH node_modules/.bin/tsc --noEmit
git diff --check
```

两项退出码均为 **0**。本批没有运行全量测试、操作模拟器或真机，也没有提交／推送；不据此宣称 CI 或 39 屏逐像素验收通过。
