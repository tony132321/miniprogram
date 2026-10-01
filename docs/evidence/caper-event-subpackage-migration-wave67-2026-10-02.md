# Wave 67 活动页无损分包迁移

## 实施与保护

主包原余 3,063 B，新增准确 UI/导航/字体无法容纳。完整活动页及相对 assets 移入 `miniprogram/subpackages/activity/event/`，保留 `/pages/event/event` 注册入口与所有既有分享、邀请及二维码 URL。redirectTo 替换轻量入口，返回栈不增加一层。旧 39 文件逐项 SHA 核对相等；JS 仅五 require 父级深度变化，逆除后回到原 104,032 B。业务字段、API、账号、资格、版本控制没有改动。

入口的有效 `%HH` 编码一次保留，剩余保留字符安全编码；微信实际 onLoad 保留 URL 编码，重复编码问题已由实际失败定位和定向回归修复。不直接 decode 任意值；malformed percent 继续安全编码，失败信息不暴露私有 query，重试、并发、过期 callback、卸载清理及返回保护保留。

app 原 20→21 路由，只增加 activity/event。21 既有测试文件仅更新 fixture URL 与新旧 require 深度兼容，业务断言逐字节逆还原；binding harness 引入真实入口工厂与 getCurrentPages 上下文。原来源文档里的旧路径保留为历史快照，不改历史证据。

## 限定验证

旧 frozen manifest/新路径证明及实际 CLI、SDK 分段记录在 [本批 JSON](caper-wave67-devtools-measurements-2026-10-02.json)。7 个指定迁移用例通过；编码修复后入口单文件 7/7。实际 canonical token 授权、来源字段 wire 值、同 ID section 深链与原前页返回栈通过；没有执行全量测试。

最终 CLI 主包 1,908,773 B、活动 394,650 B、个人 929,834 B，总包 3,233,257 B；三包各小于 2 MiB。主包余 188,379 B，较 Wave66 整合后净减少 185,316 B，这是整批实测差值，不把原始移动字节当成实际编译节省。配置没有关闭大小检查或新增有损图片压缩。
