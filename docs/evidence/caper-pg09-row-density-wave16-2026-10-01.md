# PG09 AA 费用行密度复核（2026-10-01）

对照用户 Stitch ZIP `stitch_design_system_generator (2).zip` 的 `pg09/screen.png` 与[既有五行展开截图](images/caper-pg09-five-row-expanded-2026-09-30.png)。参考图以紧凑的昵称、金额和状态列扫描五行；既有截图中第一行两枚整行按钮把列表明显拉长。参考图的“已支付／已付清”不能由 R1 费用账本证明，因此本轮只沿用服务端的 `participantHandled` 与 `hostReceived` 两方声明。

活动页把每条获授权分摊整理为一行：左侧头像占位和本场获同意昵称，中间分别显示“本人已处理／未记录”和“主办已收到／未记录”，右侧显示该行实际金额及“待双方记录／记录不一致／双方已记录”。仅当前账本提供操作；本人只能记录本人的处理状态，主办方才能记录已收到。操作改为行内并排的 88rpx 高按钮，历史版本没有操作；不改服务端写入字段、金额分摊或授权读取。状态不一致的线下核对说明移至卡片下方，保留非支付凭证提示。

回归测试先红：`test/miniprogram-event-expense-interactions.test.ts` 新测试因缺少双方状态和权限字段失败（该文件 4 过、1 败）；加入最小页面映射后，该文件 5/5 通过。再运行费用交互、活动控件及详情布局三个定向文件共 10/10 通过；`tsc --noEmit`、`node --check miniprogram/pages/event/event.js` 和目标文件 `git diff --check` 均退出码 0。未运行全量测试。

隔离模拟器尝试：已把当前 `miniprogram/` 复制到 `/private/tmp/caper-pg09-wave16/`，除副本 `config.js` 指向独立本地端口外，`diff -qr` 无差异。微信开发者工具 `cli auto --project /private/tmp/caper-pg09-wave16 --port 21468 --auto-port 9496 --trust-project` 退出码 255，明确提示当前 IDE 已在 `21467` 启动，必须重启才能改端口。为避免影响正在使用的 IDE，本轮没有打开隔离模拟器、没有新截图或实际点按；WXML/WXSS 视觉与编译结果仍待合并后的开发者工具复核。本记录不构成真机、正式 AppID 或支付验收。
