# PG02-C「我组织的」卡片两处对齐（2026-10-01）

设计依据：`stitch_design_system_generator (2).zip` 中 `stitch_design_system_generator/pg02_c/screen.png` 与 `code.html`。同屏招募卡在封面左上角有“招募中 · 还差 2 人成局”状态胶囊；已成局卡的主要按钮写“管理活动”。

小程序 `pages/index/index` 现在对当前账号主办的同场详情回读，只有 `reviewStatus=APPROVED`、`status=RECRUITING`、`recruiting=true`、详情版本与确认人数及最低成局人数均有效、报名截止时间尚未过去时，才显示封面招募缺口；否则继续显示活动真实状态，不推断人数。已成局和进行中的卡将主要按钮标为“管理活动”，仍进入同场 `hostSection`。封面缺口胶囊使用设计图对应的绿色；“发公告”“签到核销码”等其他按钮沿用已有可运行路由与真实能力。

## 定向验证

- `test/miniprogram-caper-pg02c-host-cover.test.ts` 的正例在实现前因缺少 `coverStatusLabel` 先红，实现后 **2/2** 通过。测试覆盖已审核招募缺口、已成局管理入口及同场路由；待审、缺少人数和报名已截止时均不显示缺口。
- 联合首页定向用例 **38/38** 通过；TypeScript `tsc --noEmit`、首页 JS 语法与 `git diff --check` 通过。
- 本批未跑全量测试或真机验收，也未把示意封面、未实现的群发能力或虚构人物人数称为设计逐像素一致。

## 开发者工具实点

隔离微信开发者工具中，以合成主办账号打开真实 `IN_PROGRESS` 活动的“我组织的”页，卡片主按钮实际显示“管理活动”；实点后进入同一活动 ID 的 `hostSection`，自动化异常 **0**。[卡片截图](images/caper-pg02c-manage-wave45-2026-10-01.png)；[主办工作台截图](images/caper-pg02c-host-section-wave45-2026-10-01.png)。CLI `preview` 成功；脚本 `/private/tmp/project-irl-automator/pg02c-host-management-wave45-smoke.cjs` 在本机隔离目录，不属于交付代码。

本次实点的活动是进行中状态，所以“招募中 · 还差 X 人成局”分支仅由上述定向测试覆盖，尚无该分支的改后模拟器截图，也没有真机或逐像素验收。
