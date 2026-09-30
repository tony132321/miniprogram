# PG10-C 与 PG11-C 活动入口定向修正（2026-10-01）

设计基准：`/Users/tsb/Downloads/stitch_design_system_generator (2).zip` 中的 `stitch_design_system_generator/pg10_c/{screen.png,code.html}` 与 `stitch_design_system_generator/pg11_c_alex/{screen.png,code.html}`。PG10-C 原稿底部是“投递新活动照片”，但 R1 没有活动相册或照片上传接口；现有页面显示的是从本人 `/me/events` 读取的真实活动记录和明确标注的示意配图。PG11-C 原稿是人物私聊，R1 没有私聊接口，现有界面继续保持无人物、无消息发送的关闭态。

此前 PG10-C 底部按钮写“查看我的真实活动”，点击却切至首页；分类空态“查看我的活动”也切至首页；PG11-C 关闭态的“查看我的活动”同样切至首页。现在 PG10-C 底部按钮改为“发起新活动”，接入已有发起 Tab；分类筛选为空但本人有其他活动时显示“查看全部活动”，在本页切换至真实 `all` 列表；本人活动确实为空时显示“发起新活动”，进入发起 Tab。切换“全部”前还核对当前会话，避免旧身份列表重显。PG11-C 的“查看我的活动”进入本人活动记录 `/subpackages/profile/moments/moments?filter=all`。消息页进入记录前恢复收件箱及 TabBar 状态；活动记录仍按当前会话身份读取 `/me/events`，不添加假照片、私聊或额外权限。

定向红绿：先修改两条真实路由的断言，相关测试 **24/26 通过、2 条按预期失败**，分别命中旧首页路径和缺失的 `goCreate`。空态再补一条按钮行为回归，先 **14/15 通过、1 条按预期失败**（缺失 `showAllActivities`）。最终仅执行 `test/miniprogram-caper-message-parity.test.ts`、`test/miniprogram-caper-profile-visual.test.ts`、`test/miniprogram-moments-session-isolation.test.ts`、`test/miniprogram-messages-hierarchy.test.ts` 四个受影响文件，**29/29 通过**；`pnpm typecheck`（补齐本机 Node PATH 后）与 `git diff --check` 退出码 0。未执行全量测试，也尚无本轮微信开发者工具实点或同尺寸逐像素证据。
