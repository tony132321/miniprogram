# CAPER 发起、活动记录与行程：局部开发者工具复验

日期：2026-09-30。对照来源为用户提供的 `stitch_design_system_generator (2).zip` 中 `pg03_ai`、`caper_ai`、`pg04`、`pg10_c`、`pg10_d`、`_1`。本次只验证以下改动和真实路由；没有运行全量测试，也没有做 39 屏逐像素或真机验收。

## 发起页

- IDEA 顶部个人图标实点到 `pages/me/me`；新增“直接手动填写”进入 FORM，回读 `stage=FORM`、`draft=null`，没有触发规则建议草稿生成。
- 未开放封面样式使用包内已有摄影素材，明确标“待开放”；确认页注明“本地规则建议”。
- 开发者工具截图：[IDEA 首屏](images/caper-create-wave7-idea-2026-09-30.png)、[FORM 首屏](images/caper-create-wave7-form-2026-09-30.png)。本次只实点手动填写及个人入口，没有重新提交发布。

## 我的活动记录

- `pg10_c` 的三图拼贴使用本地示意照片并在图面注明“示意配图／活动相册未开放”。真实活动卡来自当前身份的 `/me/events`，拼贴整块可进入这场活动详情。
- 隔离开发者工具使用合成主办身份 `caper-pg05-host-20260930`：读取到本人的服务端活动，选择“我主办的”，点击拼贴后打开 `pages/event/event`，回读活动 ID 为 `0e51f241-3f63-439d-b59d-593549a61ac2`。
- [真实记录截图](images/caper-moments-wave7-real-2026-09-30.png)。无活动照片上传、下载、人脸找图或真实用户运营证据。

## 我的行程

- `_1` 行程封面跳真实活动详情；“报名与成员”“签到与到场”分别进入同一真实活动的 `registrationSection` 与 `checkinSection`。长时间 `IN_PROGRESS` 活动不再按“开始超过 24 小时”错误排除。
- 隔离开发者工具使用合成已报名身份 `caper-pg05-member-20260930`：`/me/events` 返回当前活动，两个按钮的活动 ID 均与服务端记录相同，进入的分区分别正确，运行异常数为 0。[行程首屏截图](images/caper-itinerary-wave7-member-2026-09-30.png)。
- 这张封面是示意照片；“本人活动”表示当前身份拥有活动记录，不代表真人活动或现场验收。`/me/events` 目前没有结束时间、城市字段，因此没有把设计稿中的时间段和地址伪装为已接入。

## 隐私安全

- `pg10_d` 顶部个人入口与更多菜单已接入真实个人页、隐私说明和帮助页；顶部预留微信原生胶囊位置。读取屏蔽数据前等待当前账号启动完成，旧账号请求失败不会在新账号页面展示错误；异常格式响应显示错误而不伪装空记录。
- 隔离开发者工具中当前合成身份的屏蔽列表为真实空态；点击更多→隐私说明、头像→我的页面，路由均正确，异常数为 0。[隐私安全首屏截图](images/caper-privacy-wave7-2026-09-30.png)。没有伪造原稿姓名、头像、原因或真人屏蔽记录。

## 定向检查

- `node --import tsx --test --test-isolation=none --test-concurrency=1 test/miniprogram-caper-create-reference-gaps.test.ts test/pg10-remaining.test.ts test/miniprogram-caper-profile-visual.test.ts`：**24/24**。
- `test/miniprogram-itinerary.test.ts`：**5/5**（子任务定向执行）。
- `test/pg10-profile-navigation.test.ts` 与相关个人页聚焦检查：**25/25**（子任务定向执行）。
- `pnpm typecheck` 与 `git diff --check`：通过。
- 开发者工具自动化使用测试 AppID、本地 API 和隔离项目；三个实点路径记录的 `exception` 均为空。正式 AppID、HTTPS 域名、订阅消息、真机与三场受控活动仍需真实资源。
