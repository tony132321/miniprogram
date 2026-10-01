# Wave 67 五 Tab、FORM／REVIEW、PG05／PG05-S 定向验收

## 本批实现

三子代理并行复原五种底部导航、新建 FORM（caper_ai）、草稿 REVIEW（pg04）、羽毛球报名确认（pg05）及真实报名成功（pg05_s）。共 68 个准确小 SVG（Tab 24、表单 23、活动 21）；保留原 IDEA、编辑／重大变更、generic、主办及成员业务。真实能力关闭态保留，原假红点、固定 PASS、假 QR／微信群／付费状态未作为真实事实展示。

Rubik Mono One normal400 与 Caveat 新固定字符子集准确接入；旧 Jakarta 四字重及旧两个完整许可不变，Caveat 原 27 个共同 Unicode 的轮廓、hmtx 和全局 metrics 独立比较相等。原表情／中文走系统回退；全部 shaping/raster 未作相等断言。新许可在 H3 显示，9→10 实际资源。

独立源审查：[B/C](caper-form-event-independent-review-wave67-2026-10-02.md)、[Tab](caper-global-tabs-independent-review-wave67-2026-10-02.md)、[字体](caper-registration-fonts-independent-review-wave67-2026-10-02.md)。完整活动页分包迁移详见 [迁移证据](caper-event-subpackage-migration-wave67-2026-10-02.md)，原邀请 URL 保留。

## 微信与定向证据

完整隔离源码 474 文件与仓库相等（排除本机 config.js/.DS_Store）。实际微信 CLI 最终 exit0：main **1,908,773 B**／activity **394,650 B**／profile **929,834 B**／total **3,233,257 B**；主包余 **188,379 B**。本批未改变 root 项目配置，关闭 sourceMap 对照实际节省 0 B，未据此做包体改动。

[分段完整记录](caper-wave67-devtools-measurements-2026-10-02.json)：**41 条成功 SDK 断言**、6 张已查看 PNG；harness 失败与只补剩余检查的过程完整保留，不把失败删掉后计为一次成功全跑。

- 五页通过实际 SDK switchTab 核 selected／生命周期；IDEA、REVIEW 隐藏，FORM 真实 safe34px＋content64px，中心60px；其他 source variants 对应实际 max-width、glyph／label。SDK Page selector 无法直接取得 custom Tab 按钮，因此不声称本批通过 native 五 Tab 实点。
- FORM 实际 input、可见快捷日期、主办参与 radio、生成按钮→真实 `/events` 草稿回读，REVIEW 当前 payload／版本、行编辑返回保持同 draft ID；本批没有发布。新 header 我的／本人草稿箱／返回 IDEA 按钮实际可达。
- FORM 下方→REVIEW 初次实拍沿用滚动位置，顶部 banner 隐藏；最终 publish setEditorData callback 将 viewport 滚回0，定向复拍首 banner 可见，业务与 API 未变。
- canonical 邀请 URL 实際加载同合成活动；入口初次重复 source `%HH` 编码，经失败定位修复，最终实际 source 保留同一 wire 值、栈仅原页＋业务分包。id／section 深链及两次返回恢复原页。
- PG05 打开／取消没有提交席位；再次确认通过真实 API 提交，当前 registration 为 CONFIRMED 才出现新 PG05-S。16 条报名链路断言通过，成功不是前端注入制造。后续部分 success 控件单独检查需要恢复展示态，均在 fresh API 同 ID/CONFIRMED 核对后执行 UI-only restore，并逐项标记，不能当作再次报名。
- PG05-S 当前地点剪贴板相等、信息复制、签到／公告／成员／详情同 ID、行程包含该确认席位。日历原 API在模拟器能力不足时显示真实不支持文案，没有日历落盘。
- 六字体实际 success callbacks 均 loaded，PG05 可见 Rubik/Caveat，PG05-S Jakarta、H3十项资源与Rubik说明渲染。

迁移指定用例 7/7、编码修复后入口单文件 7/7；此前6项入口已独立通过。不运行本机全量或 CI；Git批次使用 `[skip ci]`，提交后另核不可变 tree／PR head／workflow。

## 失败定位与范围

四个失败分段保留：discover 没有 loadState，harness 改查其实际 city 状态；表单 offscreen tap／未等异步事件导致早读，改为实际滚动到目标并等待 handler 状态；入口 source 双编码是真实产品问题并已修复；草稿箱真实状态是 organized＋draftsOnly，harness 原期望 drafts 不成立。没有因这些失败扩大到全量。滚动继承问题另由实拍发现并修复，旧图仍保留。

Mac 仍锁屏，computer use 无 native 点击／弹窗结论；正式 AppID、HTTPS、订阅模板、真机与真人运营／三场活动仍待资源。菜单 native 展示、日历授权落盘、全长39屏同尺寸逐像素与尚未逐页重建部分继续验收，不能声称整体100%。

## 提交必要检查

凭证扫描通过：1,320 tracked text／1 ZIP／570 binary skips，值未打印。完整 cached whitespace check 对原版 Rubik OFL 的 CRLF／原尾空格给出告警；该 4,462 B 官方许可 staged bytes 与来源／独立核对完全一致，保留原文，不改第三方许可。仅排除此精确文件，其余 cached whitespace check exit0，未修改仓库 whitespace 配置。
