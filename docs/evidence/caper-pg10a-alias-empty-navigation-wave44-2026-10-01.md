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

## 开发者工具补验

- 在隔离小程序工程的微信开发者工具模拟器中，以合成的无活动账号 `caper-pg10a-empty-wave44` 打开资料页，实点“设置本场昵称”，确认弹层为无可设置活动的空态；再实点“查看我的活动”，实际到达 `subpackages/profile/moments/moments`，筛选为 `all`、列表为空。自动化采集的异常为 **0**，随后恢复主办账号首页。
- [本场昵称空态截图](images/caper-pg10a-alias-empty-wave44-2026-10-01.png)；[跳转后的本人活动空态截图](images/caper-pg10a-activities-empty-wave44-2026-10-01.png)。使用开发者工具 CLI `preview` 后由小程序 Automator 实点，脚本在 `/private/tmp/project-irl-automator/home-profile-wave44-smoke.cjs`；该路径是本机验证脚本，不属于交付工程。
- 这是合成账号的模拟器导航证据，不代表真机、微信正式登录或全页逐像素验收。本轮没有运行全量测试。
