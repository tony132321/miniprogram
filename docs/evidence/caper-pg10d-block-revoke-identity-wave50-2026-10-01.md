# PG10-D 解除屏蔽的会话隔离（2026-10-01）

设计依据：`stitch_design_system_generator (2).zip` 中 `pg10_d/{screen.png,code.html}` 的「已屏蔽用户」列表和「解除屏蔽」按钮。R1 列表始终来自当前会话的 `/me/blocks`；没有服务端提供的成员昵称、头像或屏蔽日期时，页面保持真实空态或匿名摘要。

原页面在列表已加载后，仅凭缓存的 `READY` 状态和行 ID 就向 `/me/blocks/:id/revoke` 发送请求。若账号切换发生在页面再次 `onShow()` 前，旧账号的行会在新会话下发起解除请求；退出登录后也会发起请求。现在页面仅在 `/me/blocks` 成功回读时记录列表所属会话。点击解除时若当前会话不符，就立即清空旧列表并读取新会话；退出登录则呈现登录门控，不发送解除请求。若已发出的解除请求返回前会话切换，回调只刷新仍留在旧页面的列表，不写入旧账号成功提示。服务端仍决定可解除的真实权限。

## 定向验证

- 新增 `test/miniprogram-pg10d-block-revoke-identity.test.ts`，覆盖切换账号后点旧行、退出后点旧行、解除请求未返回时换账号。前两例修改前 **0/2**；第三例补测时 **0/1**，修复后 **3/3**。
- 隐私页与原举报入口相关用例合计 **10/10** 通过；页面 JS 语法检查、全局 `tsc --noEmit` 退出 0。
- 扩大到整个 `test/pg10-profile-navigation.test.ts` 时，原路由夹具因 `profile-edit.js` 已有城市工具导入而报 `unexpected require ../../../utils/city.js`；主代理在该测试夹具补入真实城市工具模块后重跑，同文件 **10/10** 通过。该调整只修复测试装载，不改个人资料页行为。未跑全量测试；没有真实账号／真机实点。

## 隔离微信开发者工具复核

- 在保留本地测试 `config.js` 和 `project.config.json` 的隔离项目中，同步本批已提交的 `messages.js`、`me.js`、`create.js`、`privacy-safety.js`；此前的 `cache`、`event`、`city` 改动也在该副本中。CLI `preview` 退出 0，包体 `2,235,223` 字节。
- 使用受控合成账号，从「我的」顶部“隐私与设置”入口实点进入 `subpackages/profile/privacy-safety/privacy-safety`。服务端 `/me/blocks` 与页面均为 **0 条**，显示“暂无屏蔽记录”；“前往举报与求助”入口可见，右上角菜单可展开三个页面入口；该路线 `exception=0`。[真实空态模拟器截图](images/caper-pg10d-privacy-empty-wave50-2026-10-01.png)没有成员姓名或其他个人敏感数据。
- 在同一模拟器页面临时注入一条仅存在于页面数据的**合成旧会话行**，切换到另一受控合成账号后实点“解除屏蔽”。请求探针拦截所有 POST 以避免误写：本次点击记录 `POST=0`、`/me/blocks` 重新读取 `GET=1`，旧行被清空并回到 `READY` 空态，`exception=0`。这验证了小程序当前页的会话门控；真实存在的屏蔽记录和真机仍未实点。
