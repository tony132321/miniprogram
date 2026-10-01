# PG10-A 本场昵称空态跳转证据（2026-10-01）

## 范围与修正

- 参照用户提供的 `stitch_design_system_generator (2).zip` 中 `stitch_design_system_generator/pg10_a_edit_profile/screen.png` 与 `code.html`，沿用现有 `profile-edit` 页面和真实活动内昵称能力。本轮仅修正该页“设置本场昵称”弹层的空态按钮；参考稿本身没有这个运行时空态。
- 先前页面在已登录但当前无可设置昵称的活动时显示“查看我的活动”，点击却切回“我的”Tab。现在该按钮进入已存在的本人活动记录 `/subpackages/profile/moments/moments?filter=all`，并在离开前关闭选择弹层。未登录状态的“前往我的页面登录”仍进入“我的”Tab。
- 本次不新增资料保存、全局昵称或活动相册接口，也不把设计稿中的示意个人资料当作真实用户数据。

## 定向验证

| 检查 | 结果 |
| --- | --- |
| 测试先行 | `node --import tsx --test --test-concurrency=1 test/miniprogram-profile-edit-alias-entry.test.ts`：新增空态跳转用例按预期失败，发现 WXML 按钮绑定仍是 `goProfile`。 |
| 修改后同文件 | **4/4 通过**；包含可设置昵称活动筛选、未登录／空态／错误分支、空态按钮跳转，以及账号切换后旧响应不能恢复活动。新增用例断言 WXML 绑定、精确目标路由与关闭弹层。 |
| 静态检查 | `node node_modules/typescript/bin/tsc --noEmit`、`node --check miniprogram/subpackages/profile/profile-edit/profile-edit.js`、`git diff --check` 均退出 0。 |

本轮遵循并行隔离要求，只做定向测试和静态检查，未运行全量测试，也未占用共享微信开发者工具 IDE，因此**没有该按钮的模拟器实点截图**。本条证据仅证明页面绑定和导航方法的定向行为；开发者工具里的实际触控仍待该页面独占窗口时补验。
