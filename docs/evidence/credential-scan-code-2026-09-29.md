# AC-SECURITY：跟踪源码凭证扫描门禁（2026-09-29）

## 范围与实现

v3.1 `engineering/tasks/T34.md` 的 `AC-SECURITY` 要求凭证扫描及无硬编码密钥。新增 `scripts/scan-credentials.ts`，由 `.github/workflows/r1-ci.yml` 的 `checks` 任务在类型检查和测试前运行。脚本读取当前 Git 索引中的文件清单，再扫描工作区中对应的 UTF-8 文本；覆盖已跟踪的代码、配置、SQL 和文档，包含 `.env.example`。它识别私钥头、常见 AWS/GitHub/OpenAI/Google/Slack 令牌形状、字面量微信 AppSecret，以及高熵的通用密钥字段赋值。

发现时输出**文件、行号、类别**并返回非零状态，不输出命中的原始值。示例或测试占位串（如 `replace-me`、`test-secret`、`YOUR_PASSWORD_PLACEHOLDER`）不作为通用密钥命中；这不等于允许真实凭证写入测试文件。

扫描边界明确：原始用户交付 ZIP 已被 Git 跟踪，因此逐个检查其中可解码的 UTF-8 文本条目；其展开目录目前未被跟踪。`project.private.config.json` 受 `.gitignore` 排除；**若私有配置或展开目录被误加入 Git，扫描器不豁免**。压缩包中无法按 UTF-8 解码的条目、其他二进制文件、未跟踪文件及 Git 历史提交不在本次扫描范围。命名或编码方式不符合上述规则的密钥仍可能漏检；CI 通过不能替代托管密钥管理、历史泄漏检查或提供方撤销与轮换。

## 行为验证

`test/credential-scan.test.ts` 在临时真实 Git 仓库中运行扫描脚本，验证：跟踪的 AWS/Google 形状密钥、微信 AppSecret、高熵 `clientSecret` 及 ZIP 内文本令牌使扫描失败；诊断不含密钥值；测试占位和未跟踪的本机输入不触发误报。独立审查发现原实现对两个敏感路径的显式豁免会掩盖误提交，新增强制跟踪测试先失败；随后 ZIP 内令牌测试也先失败，两项修复后 **6/6** 通过。

本机执行：该次定向测试 **6/6** 通过；新增界面、审核文件与模拟器截图加入 Git 索引后 `pnpm exec tsx scripts/scan-credentials.ts` 返回 `Credential scan passed: 510 tracked text files, 1 ZIP archives inspected, 164 binary files skipped.`；`pnpm typecheck` 与 `git diff --cached --check` 退出码 0。该次整合候选 `pnpm test` **661/661** 通过。此后消息页异步响应回归修复的整套测试 **663/663** 通过，远端 [R1 CI 运行 51](https://github.com/tony132321/miniprogram/actions/runs/36495303832) 已通过。页签复测截图加入后本机全量 **663/663**，扫描再次通过：510 个跟踪文本、1 个 ZIP、165 个跳过的二进制文件；新增候选以对应提交和独立 CI 输出为准。
