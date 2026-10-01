# CAPER 发现页附近双栏：本人活动行（2026-10-01）

设计来源为 `stitch_design_system_generator (2).zip` 的 `caper_4/screen.png` 与 `code.html`：该段采用左地图、右活动行。现有 R1 没有公开附近活动、距离或定位接口，因此右侧仅在当前账号 `/me/events` 返回与浏览城市相符的本人活动时，展示真实标题、状态、时间和场地；点击用既有活动 ID 进入详情。此时区块标题明确为“我在{城市}的活动”。城市是浏览偏好，地图明示没有读取精确位置。无匹配活动时保留“附近活动待开放”和城市选择。

列表最多三条，独立于下方“与你有关的活动”首三条；只纳入 `RECRUITING`、`CONFIRMED`、`IN_PROGRESS` 且结束时间尚未到的活动，待审或暂停招募的主办活动不纳入。取消、过期、已完成、结束时间缺失或已过的活动不进入此卡。换账号时清空旧列表，过期请求不能回写，旧账号卡片不能打开。仍保持 `discoveryEnabled=false` 且 `publicItems=[]`，不表示公开附近活动已上线。

`/me/events` 对非主办成员不返回 `recruiting`。因此成员看到 `RECRUITING` 状态时只显示中性“待成局”，不宣称仍可报名；本人活动仍可点击进入详情，以服务端当前规则为准。主办人有审核和招募字段时，仍据这些字段显示“待审核”“招募暂停”或“招募中”。

## 定向代码验证

- `node --import tsx --test test/miniprogram-discover-personal-events.test.ts test/miniprogram-discover-nearby-chip.test.ts test/miniprogram-discover-actions.test.ts`：**11/11** 通过。覆盖跨城市过滤、取消/过期/完成/已过结束时间与待审主办活动排除、成员缺失招募字段时的中性文案与可点击详情、主办真实招募字段、跨账号旧卡阻断、关闭态入口。
- `tsc --noEmit`、`node --check miniprogram/pages/discover/discover.js`、相关文件 `git diff --check`：退出码 **0**。
- 未运行全量测试。[Wave 55 完整同步的微信工具复核](caper-wave55-full-integrated-devtools-2026-10-01.md)已实点深圳 2 条本人同城活动及首行同 ID 详情、北京关闭态与城市选择，三张相关截图中的发现页两张、异常 0。仍不是公开附近、真机定位或逐像素验收。
