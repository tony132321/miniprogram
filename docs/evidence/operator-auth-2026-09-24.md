# 运营身份验证（2026-09-24）

自动化测试使用临时密码和验证码种子：生产模式 `/ops/auth/login` 通过密码与动态验证码后才发放独立令牌；开发身份不可进入运营接口，运营令牌不可进入普通用户接口；错误密码、重放的验证码、过期、凭据轮换及退出后的会话均被拒绝；第 11 次每分钟同来源登录请求返回 429。`test/operator-auth.test.ts` 还验证 RFC 6238 的 SHA-1 测试向量（59 秒、6 位结果 `287082`）和两次并发登录只接受一次动态验证码。`test/operator-ui.test.ts` 验证退出请求失败时不谎报成功、退出后的旧刷新结果不会重新显示工单。

新增多个独立账号的配置测试：两个账号各自密码与验证码登录，审计记录保留各自的 `operator:<username>`；其中一人通过 HTTP 处理举报后，`REPORT_STATUS` 审计行记为该人的身份。配置中移除一人后，仅该人的旧令牌失效。重复用户名、共用验证码种子、非规范 Base32 编码、空列表、显式空字符串及格式错误的 JSON 均被拒绝。未配置仍关闭生产运营登录；原单账号配置作为迁移兼容路径保留。

在本机 PostgreSQL 18.6 全新空库 `irl_r1_test_opsauth_v7_20260924` 运行 `scripts/verify-postgres.ts`：两连接池启动只记录 7 版迁移，100 人竞争最后席位得 1 人确认、99 人候补；相同验证码跨连接池并发仅有 1 次成功，令牌可跨连接池读取，退出后跨连接池失效。脚本输出 `migrations=7`、`pools=2`、`operatorOtpSingleUse=true`、`operatorCrossPoolSession=true`。此前已应用第 6 版迁移的本机测试库也由 `createProductionDatabase` 升级至 1–7 版，没有修改已应用迁移的校验值。

在另一全新空库 `irl_r1_test_multiops_20260924` 复跑脚本，得到 `migrations=7`、`confirmed=4`、`waitlisted=99`、`operatorOtpSingleUse=true`、`operatorCrossPoolSession=true`、`operatorIndividualAccounts=true`。第二位合成运营人员的令牌可跨连接池访问，配置移除该人后被拒绝。

这是一组本机与合成凭据的验证。没有真实运营人员注册、设备遗失恢复、域名 TLS、反向代理、目标托管 PostgreSQL 和生产审计留存验收；因此不代表运营系统已可上线。
