# 城市选择与我的行程：第 15 轮局部对照

日期：2026-10-01。逐项查看用户 ZIP 的 `pg02_loc_city_selection/screen.png`、`code.html` 和 `_1/screen.png`、`code.html`，与当前 `pages/city/city`、`subpackages/activity/itinerary/itinerary` 及既有 [城市与行程实点](caper-city-itinerary-create-devtools-2026-09-30.md)、[本人活动安全摘要实点](caper-safe-summaries-wave10-2026-09-30.md) 对照。本轮未占用其他代理的开发者工具端口，证据以源码和定向测试为限。

| 页面 | 对照与本轮处理 |
| --- | --- |
| `pg02_loc_city_selection` | 当前页面沿用参考稿的顶栏、搜索框、当前城市、热门 10 城、九组字母列表和侧边索引；汉字/拼音搜索与手动选城接到本机 `irlSelectedCity`。修正读入旧版或错误存储值时可把任意字符串显示为当前城市的问题：只接受现有可检索城市，否则界面回退到上海。已保存的厦门等扩展城市仍保留。GPS/重新定位仍只展示手选说明。 |
| `_1` 我的行程 | 当前页面沿用参考稿的顶部介绍、主活动大图、时间/场地/费用三项、后续日程卡。数据取当前身份 `/me/events` 的授权摘要，封面和报名/签到/详情按钮进入同一真实活动；长期进行中活动仍保留。修正同一 `userId` 下更换 `sessionToken` 后，旧身份行程卡仍可进入详情的问题；身份键现在同时包含会话令牌和用户 ID，触碰旧卡会清空并要求重载。原稿永久 PASS、固定队友及系统日历同步没有对应 R1 能力，当前页面仍明确不宣称。 |

先运行新增定向用例得到两项预期失败：不支持的保存城市被直接显示；同一用户 ID 换会话后旧行程仍进入详情。最小修正后，`test/miniprogram-caper-city.test.ts`、`test/miniprogram-caper-city-navigation.test.ts`、`test/miniprogram-itinerary.test.ts` **13/13 通过**，`git diff --check` 通过。未运行全量测试，未产生新的模拟器/真机截图；既有 E16/E47 仅证明当时的局部点击，本轮以当前聚焦测试补足身份和本机数据边界。
