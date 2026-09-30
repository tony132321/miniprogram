# PG10-C 底部按钮安全区（Wave 22）

设计基准：`/Users/tsb/Downloads/stitch_design_system_generator (2).zip` 内 `stitch_design_system_generator/pg10_c/screen.png`。原稿将底部主按钮置于系统手势区上方。当前项目的相册上传功能尚未开放，按钮实际进入可用的发起页；本次只调整它的屏幕位置与末尾滚动留白。

## 发现与修改

- [修改前开发者工具截图](images/caper-moments-pg10c-wave14-2026-09-30.png) 的蓝色固定按钮覆盖了底部黑色手势条。该截图来自早期版本，按钮旧文案为“查看我的真实活动”；当前按钮文案与目标已在 Wave 19 改为“发起新活动”，但 `moments.wxss` 原有 `bottom:18rpx` 未避让安全区。
- `miniprogram/subpackages/profile/moments/moments.wxss` 把固定按钮底边设为 `calc(18rpx + env(safe-area-inset-bottom))`，同时把页面底部留白设为 `calc(180rpx + env(safe-area-inset-bottom))`。这样在有手势区的设备上，按钮和最后的内容均上移；无安全区的设备仍使用原有 `rpx` 间距。

## 定向验证

- 原样式在 390 px 视口下 `18rpx` 约为 9.36 px，低于旧模拟器截图可见的约 34 px 手势安全区。新样式按相同尺寸计算，按钮底边约为 43.36 px，页面底部留白约为 127.6 px。
- 样式变更较小且可逆，不保留仅照搬 CSS 算式的单元测试；以开发者工具同设备截图和实际按钮点击作为后续验收。`pnpm typecheck` 与 `git diff --check` 均通过，本轮没有运行全量测试。

## 尚待开发者工具复拍

此轮没有操作共享微信开发者工具。需要在同一 iPhone 尺寸下打开 PG10-C，观察新版按钮完全高于手势条，滚动至末尾时最后一张活动卡可读，并实点按钮进入发起页。当前只有修复前截图与代码定向验证，不能据此声称新版已通过模拟器视觉验收或真机验收。
