# PG05-S 报名成功卡庆祝区复核（2026-10-01）

## 参考与改动

用户 ZIP `/Users/tsb/Downloads/stitch_design_system_generator (2).zip` 中 `stitch_design_system_generator/pg05_s/screen.png` 的绿色对勾上叠放荧光绿 `YOU'RE IN!` 与粉红 `READY TO PLAY` 贴纸，标题前有庆祝图形。此前小程序成功卡截图只有前一张贴纸。本次仅调整 `successState=JOINED` 的庆祝区 WXML/WXSS：新增两张叠放贴纸、标题前的庆祝图形，并将确认标签简化为纯中文。`READY TO PLAY` 只在 `display.isBadminton` 时显示；其他活动仍使用通用成功文案。服务端确认席位、活动事实、日历、地点复制及导航处理未改动。

参考图中的固定电子凭证码、微信群入口和主理人微信号没有对应的当前产品数据或服务能力，仍使用既有动态签到入口、当前活动事实和真实成员入口。

## 定向验证

| 检查 | 结果 |
| --- | --- |
| 相邻报名和活动页用例 | `PATH=/Users/tsb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH node --import tsx --test --test-concurrency=1 test/pg05-confirmation.test.ts test/event-caper-navigation.test.ts`：**21/21 通过**。 |
| 类型及差异 | 同一 `PATH` 下 `pnpm typecheck` 退出 0；`git diff --check` 退出 0。 |
| 微信开发者工具编译 | 将 `miniprogram/` 复制到 `/private/tmp/irl-pg05s-final-20261001`，仅将副本 `config.js` 的 API 地址改成隔离本地 `127.0.0.1:3037`；复制时 `diff -qr --exclude=config.js` 无差异。测试 AppID `wxbbcab69099026d3f`，CLI `preview --port 21467` 退出 0，总包 **1,978,520 Byte**。截图后的并行消息页改动使全目录再次比较出现该页差异；PG05-S 的 `event.wxml` 和 `event.wxss` 逐文件 `cmp` 仍一致。 |
| 已确认成员界面与实点 | 自动化端口 `9536`，脚本 `/private/tmp/project-irl-automator/caper-pg05s-final-smoke-20261001.cjs`。合成成员 `caper-r1-actor-20260930` 打开合成活动 `97ed8055-27fb-484e-87a2-9986805fcae1`，真实本地 API 回读本人 `CONFIRMED`，非主办，活动为羽毛球。自动化为这个已确认成员暂时显示 `JOINED` 成功卡以检查视觉；[当前成功卡截图](images/caper-pg05s-success-header-2026-10-01.png)显示两张贴纸、标题、活动时间、地点与按钮。实际点击底部“查看活动详情”后，同场活动的 `successState` 清空、`activeSection=detailsSection`，捕获小程序 `exception` **0**。脚本随后恢复成功卡，供界面查看。 |

本轮没有再次提交报名；`JOINED` 展示由自动化在已确认成员页设置，仅用于本次布局与点击核查。没有实点系统原生日历，也未验证日历落盘、真机、正式 AppID/HTTPS 或参考稿的静态凭证／微信群能力。以上为本地定向证据，未运行全量测试。
