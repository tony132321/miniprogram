# 城市搜索连续输入焦点（2026-10-01）

设计依据：`stitch_design_system_generator (2).zip` 中 `pg02_loc_city_selection/screen.png` 与 `code.html` 的城市搜索框。现有 R1 城市页用 `focus="{{searchFocused}}"` 控制输入框，并支持中文和拼音筛选。点清空键或「搜索更多城市」时，页面会将 `searchFocused` 设为 `true`，使用户继续输入。

原 `search()` 在每个输入事件里立即将 `searchFocused` 设为 `false`。这样输入第一个拼音字符后，受控焦点状态便与继续输入的意图相反。现在输入事件只更新检索结果，不改焦点状态；清空后可以持续输入 `beijing`，仍只显示「北京」。城市存储和返回路由没有改动。

## 定向验证

- 新增 `test/miniprogram-city-search-focus.test.ts`，断言清空后输入 `b` 与 `beijing` 都保留受控焦点且筛选正确。修改前 **1/1 失败**，修改后 **1/1 通过**。
- 城市页相关四个测试文件 **12/12** 通过；`city.js` 语法检查、全局 `tsc --noEmit` 均退出 0。
- 本批未运行全量测试、微信开发者工具或真机实点；焦点在实际微信输入法中的表现仍需模拟器或真机复点。本修复不引入 GPS 定位或公开活动列表。
