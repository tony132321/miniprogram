# Wave 52 首页历史卡与发布成功页微信工具复核（2026-10-01）

隔离小程序工程：`/private/tmp/caper-r1-e2e-20260930/miniprogram-project`，测试 AppID `wxbbcab69099026d3f`，本机 API `127.0.0.1:3037`。完整 `miniprogram/` 同步后，除隔离工程专用 `config.js` 外，`diff -qr` 无差异。微信开发者工具 CLI 预览退出 0：总包 **1,984,300 Byte**、主包 **1,779,475 Byte**。这次 CLI 包含 PG02-D 新版首页和 PG04-S 邀请有效期、写入口保护；后续 PG06 与消息页并行改动不在此快照。

自动化第一次仍读取到旧版首页数据（历史卡没有新日期、状态标签仍是“已报名”）。隔离源码有新字段，关闭并重新打开**该隔离项目**、重启同端口自动化后，同一账号和活动返回 `historyPosterDateLabel="10 月 3 日 · 往期活动"`、`cardLabel="已取消"`。因此下面的实点和截图均取重新载入后的版本，不使用旧快照作为验证。

## PG02-D 历史卡

合成成员 `caper-r1-actor-20260930` 的本人活动 `f3175aaf-e4cf-480a-9153-abf015c3c34f` 为 `CANCELLED`、`feeMode=AA`。历史卡显示实际活动日期、活动状态、标题、场地、AA 标识和两枚 CTA；长合成标题在封面两行内，底部两枚按钮未重叠。[本次截图](images/caper-pg02d-history-final-wave52-2026-10-01.png)后来被发现保留了不恰当的庆祝贴纸，已在[修正后复拍](images/caper-pg02d-history-neutral-wave54-2026-10-01.png)改为取消活动中性色与“10 月 3 日 · 已取消”。点击“查看活动记录”进入同 ID 活动的 `detailsSection`；重新进入首页后点击“查看 AA 记录”进入同 ID `expenseSection`，账本加载 `READY`；修正后重复实点仍通过。自动化页面异常 **0**。这证明取消历史卡的两条当前路由，不代表已结项主办、五星评价或相册实点。

## PG04-S 发布成功页

合成已审核主办 `caper-r1-offer-host-20260930` 的活动 `97ed8055-27fb-484e-87a2-9986805fcae1` 从当前服务端返回 `status=RECRUITING`、邀请剩余时长 `inviteRemainingMs>0`；页面进入 `PUBLISHED`，资格贴纸为 `INVITE READY!`，四格动作均存在。[顶部图卡](images/caper-pg04s-final-top-wave52-2026-10-01.png)、[四格和主次按钮](images/caper-pg04s-final-actions-wave52-2026-10-01.png)。分享、海报、复制三个按钮分别到达同 ID 邀请卡；分享按钮进入时 `canShare=true`、`shareSheetOpen=true`。四格“成员与协办管理”及页底主按钮定位同场 `hostSection`；页底次按钮定位 `detailsSection`。六个入口的页面异常 **0**。复制动作产生的本机合成口令已清空剪贴板。

本轮没有触发微信原生分享选择器的实际投递，也没有真实口令过期后的墙钟等待、真机扫码、正式 AppID 或 HTTPS 域名验收。PG02-D/PG04-S 视觉仍是同设备局部对照，不是 39 屏逐像素通过；未运行全量测试。
