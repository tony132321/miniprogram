# Wave 24：按钮与路由静态核对

对当前 `miniprogram/app.json` 中 8 条主包、10 条个人分包和 2 条活动分包路由，逐页核对 WXML 的 `bind*`／`catch*` 事件处理方法、JS 中硬编码的小程序页面目标，以及 `open-type="share"` 的分享回调。20 条路由均已注册，未发现缺失的事件处理方法或指向未注册页面的硬编码目标。按钮是否实际可触达、原生弹层是否可操作，仍需开发者工具和真机实点；这次仅是静态核对。

发现两处同类错位：活动读取失败／登录等待页的“回到我的活动”（`pages/event/event`）以及发起页的活动读取失败态和已发布活动编辑返回动作（`pages/create/create`）以前都会切换到首页顶部。两处现复用已有的 `/subpackages/profile/moments/moments?filter=all`，直接进入本人真实活动记录。更新现有行为测试后，`invite-miniapp-refresh.test.ts` 与 `miniprogram-caper-create.test.ts` 定向运行 **21/21** 通过，`git diff --check` 通过。未运行全量测试或微信开发者工具；其余页面未作视觉或逐按钮结论。
