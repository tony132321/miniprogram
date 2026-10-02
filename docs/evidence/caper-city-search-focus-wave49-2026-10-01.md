# 城市搜索连续输入焦点（2026-10-01）

设计依据：`stitch_design_system_generator (2).zip` 中 `pg02_loc_city_selection/screen.png` 与 `code.html` 的城市搜索框。现有 R1 城市页用 `focus="{{searchFocused}}"` 控制输入框，并支持中文和拼音筛选。点清空键或「搜索更多城市」时，页面会将 `searchFocused` 设为 `true`，使用户继续输入。

原 `search()` 在每个输入事件里立即将 `searchFocused` 设为 `false`。这样输入第一个拼音字符后，受控焦点状态便与继续输入的意图相反。现在输入事件只更新检索结果，不改焦点状态；清空后可以持续输入 `beijing`，仍只显示「北京」。城市存储和返回路由没有改动。

## 定向验证

- 新增 `test/miniprogram-city-search-focus.test.ts`，断言清空后输入 `b` 与 `beijing` 都保留受控焦点且筛选正确。修改前 **1/1 失败**，修改后 **1/1 通过**。
- 城市页相关四个测试文件 **12/12** 通过；`city.js` 语法检查、全局 `tsc --noEmit` 均退出 0。
- 未运行全量测试。本修复不引入 GPS 定位或公开活动列表。

## 隔离微信开发者工具复点及边界

- 仅把当前 `pages/city/city.js` 同步到隔离项目 `/private/tmp/irl-pg10f-wave48-sim`；微信开发者工具 CLI `preview` 退出 0，包体 `2,233,555` 字节。Automator 打开 `pages/city/city`，实点「搜索更多城市」。
- 使用 Automator 的 `InputElement.input` 依次送入 `b`、`be`、`bei`、`beij`、`beiji`、`beijin`、`beijing`；每一步等待页面 `query` 更新，观察 `searchFocused=true`、输入框值与查询一致。最后只显示「北京」一项，输入框 `focus` 属性为 `true`，捕获 `exception=0`。[最终结果截图](images/caper-city-search-focus-wave49-2026-10-01.png)不含敏感信息。
- `InputElement.input` 是程序化输入，不能可靠证明真实微信输入法没有在字符之间失焦。尝试用 Computer Use 操作开发者工具原生键盘时，宿主 Mac 已锁定且自动解锁不可用，因此本轮**不声明真实输入法焦点实点通过**；这部分仍需解锁后的原生键盘或真机复核。
