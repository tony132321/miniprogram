# Wave 67 源码映射包体对照

root实际执行。同Wave66 a848617 的409文件preview clone，仅 project.config.json.setting.uploadWithSourceMap true→false，其他config/data/assets/产品不变。配置旧SHA971c6b6008d45ee4c3e5429ca8fd6d9f9d411a8b06418a39de49e86f9cf96469，新SHA5a92a83eccc6986b7ae3e7f22a1cd66078e91dfeef8736988131a5e993dbbf2f。CLI session44850 exit0；产物 /private/tmp/caper-wave67-mapoff-preview-info.json。

| 配置 | 主包 | activity | profile | 总包 |
| --- | ---: | ---: | ---: | ---: |
| maps true，Wave66最终 | 2,094,089 | 78,943 | 929,315 | 3,102,347 |
| maps false，必要对照 | 2,094,089 | 78,943 | 929,315 | 3,102,347 |

**实际包体收益0 B**，未采用关闭maps作为优化。clone config已从原备份逐字节恢复，仓库配置未改；没有 UI／业务／全量测试或CI。此对照只回答本地CLI计量，不推断所有上传客户端maps行为。后续移分包方案见本批计划，实际收益仍待新的CLI验证。
