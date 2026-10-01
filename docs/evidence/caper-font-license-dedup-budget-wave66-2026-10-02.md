# Wave66 字体许可正文去重与主包预算修正

日期：2026-10-02。owner：`/root/ui65_font_audit`。根代理真实Wave66 preview主包 **2098454 B**，超过2MiB（2097152 B）**1302 B**；CLI exit0不能使超预算验收通过。根代理仅授权 `miniprogram/utils/reference-font-data.js` 的重复许可正文去重及本独立证据，未授权变更字体资源、loader、API或UI。

## 1. 先核原公共正文，再进行最小修改

读取两份既有准确官方许可文件的原始UTF8字节：

| 原许可 | 完整B | 独有版权前缀B | 公共正文B | 完整原SHA256 |
| --- | --- | --- | --- | --- |
| `docs/licenses/caveat-OFL-1.1.txt` | 4385 | 82 | 4303 | `1f9d81d094273d82f3898a1ee8b598a717d050ecbf5ff7bede105b704880157b` |
| `docs/licenses/plus-jakarta-sans-OFL-1.1.txt` | 4402 | 99 | 4303 | `995c7199cab65954f545996326755daee7b63cc6b42b06c13da1f9502ab08a99` |

公共正文SHA256：`7309a84b1f0da19cd96ffd55ea3267d33ac8b6b977cf527daeca071d32ab7b07`。公共正文包含版权段后的原空行、完整SIL OFL1.1文本与原结尾LF，**没有strip、截短、重排、修改版权或删尾部空白**。

两段版权原样保留：

- `Copyright 2014 The Caveat Project Authors (https://github.com/googlefonts/caveat)` 和原LF，82 B，SHA256 `2add6a19c1143ad24884396a0eeb4ab12f270fd0a0214739e1d13e90ac7622e5`。
- `Copyright 2020 The Plus Jakarta Sans Project Authors (https://github.com/tokotype/PlusJakartaSans)` 和原LF，99 B，SHA256 `13e60634b6b9640edcf56feb8b0add0617be9d8c3e23e66a17116e8e2bb9e934`。

确认正文完全相同且重用预计超过1302 B后，将公共正文编码为单个 `const OFL_COMMON_BODY` 字符串。`module.exports.licenses`仍保留原两键 `Caveat` / `Plus Jakarta Sans`，分别由原版权前缀加同一完整正文构成。没有把完整许可换成URL、摘要或许可名称。

## 2. 字体与应用逻辑的精确保护

修改只发生于末尾license声明。模块原前 **181500 B**逐字节相同，SHA256 `605084f36849ecf9ff2542ec12b20b6ce07ebb7f8d799db9234a509e35bfdb4c`。五个WOFF Base64数据、资源数组顺序、family与weight均未修改；`reference-fonts.js`、app初始化、global/scopes/API描述、fallback、页面与其他文件均没有编辑。

对原模块和新模块分别求值，完整字体资源数组JSON前/后SHA256完全相同：

`37feecabc5aa937fd78e6c3adb7aa99c6efbc3ec0df5413c9639d7e3f576c3b8`

| Family | weight | 完整face对象before/after相同SHA256 | Base64字符串before/after相同SHA256 | 解码WOFF SHA256 |
| --- | --- | --- | --- | --- |
| Caveat | 700 | `bd2db8ca17afd9ad4e8a18ed67b600eb40157ff2870479b58b5600fcfbc4a494` | `0e00e45aa4f945bef0d17d0770178b17879533f2fc8220d8572b1cc19e959b78` | `736ba5632b23a1aa7381201b8328be3ea3e286b8ede8545667f7fd6e2fbab19e` |
| Plus Jakarta Sans | 400 | `4f19b03851a511f6d4490d432fbdac8db6dd85573ce8f3b863838f6086a27d15` | `242ae6638c493964dbbaf10ed78bf7f6a8b9bc14ff8aa5e7cd3b980dd44c079b` | `3ec7f5cad1bd738387a7c9b7e18428cfb165e9b98bdd26645b9f58fceee492c0` |
| Plus Jakarta Sans | 600 | `40c84f0fd7277f4a225e5e38e8d8f26c119cb3f02a365454b085508cc868d850` | `fbc24c3642d21c7f475594e7cf6150b012564229c280582575dc45b2637c3ee6` | `918ce7b19d036bcd59d41ab6198bbf35d77cf46227e56b85274e1dd2522ca8be` |
| Plus Jakarta Sans | 700 | `f990ed226c23bbce09a9da6e16a6ff352013e141b1259bc5aaeb7680450d8cf0` | `a965465b065b409bec3fce89d3acc222bf0c816561a7cd2c92fedd5036c562d3` | `4f3f2b563317bc9b948f8aef3c24e01cbc11f342015eaf827f45533f8986d896` |
| Plus Jakarta Sans | 800 | `04cb2a4265a6f59e9c19e235136bb3be22173616fd471140aab6b4f48493d879` | `4ded5d2ed70ad636c52b7f78fb1558ceaf37eeea6442349e55f998114ea65641` | `7036e01f13e5c43a877d1d0db05f4dda5ba8f76641a64f1c137fa58170b48632` |

全部五条解码WOFF还与 `docs/design-sources/reference-fonts/` 对应原官方文件字节相同，长度分别18280 / 28828 / 29604 / 29828 / 29132 B。没有新font/subset，也未换family/weight。

## 3. 导出的两份许可完整原文相同

实际求值后从 `module.exports.licenses` 导出UTF8文件，而不是复制docs来冒充运行结果：

- `/private/tmp/caper-wave66-license-dedup/licenses-Caveat.txt`：4385 B，与原module字符串及 `docs/licenses/caveat-OFL-1.1.txt` **逐字节相同**，SHA256 `1f9d81d094273d82f3898a1ee8b598a717d050ecbf5ff7bede105b704880157b`。
- `/private/tmp/caper-wave66-license-dedup/licenses-Plus-Jakarta-Sans.txt`：4402 B，与原module字符串及 `docs/licenses/plus-jakarta-sans-OFL-1.1.txt` **逐字节相同**，SHA256 `995c7199cab65954f545996326755daee7b63cc6b42b06c13da1f9502ab08a99`。

上述比较为完整Buffer.equals，包含每个原空行/空白/URL/版权与结尾LF。两份docs许可原文件没改。

## 4. 必要验证与真实验收边界

只做这次新许可合并所必需的前后资源/导出比较；最终输出 `status: PASS`，exit0。辅助checker首个版本误以为原资源 `data` 已含 `base64,` DataURL前缀而断言失败；实际原 `data`为纯Base64字符串。只读取原字段并纠正checker，应用没有为该checker失败增加改动；最终复核完整数组/每face/纯Base64/解码WOFF/两份许可原字节通过。

未重跑Wave65五类wx.loadFontFace初始化VM或67个字体gate，没有运行全量、CI、微信、SDK、Git或页面镜像测试。原结果留独占tmp：`dedup-metadata.json`、`exact-export-comparison.json`和原模块快照；这不是新的字体功能测试或真机字体验收。

## 5. 冻结与实际包预算待测

| reference-font-data.js | B | SHA256 |
| --- | --- | --- |
| 原模块 | 190570 | `7a33f0b38e9b273ad07ed34cd3648cf8702a299c6ce6471224d04c920784cd63` |
| 新冻结模块 | 186228 | `6ffecd68c01d0586544263e1b97426f71f425bdc71c98635b5c4c71209c3ce08` |

源码节省 **4342 B**，大于已证实超出的1302 B。以此前preview减源码差值的算术是2094112 B，低于2MiB3040 B；**它不是新的编译包体结果**，编译压缩/转换可能影响差值。根代理需要再次真实preview确认主包<2MiB，本证据不能用源码算术或CLI exit0提前声明预算通过。

本任务仅产品模块和本报告两个自有文件，冻结hash保存在 `/private/tmp/caper-wave66-license-dedup/frozen-owned-hashes.json`。原Wave65source/font/license证据是历史冻结来源；本轮没有改其文件、字体、许可或业务。
