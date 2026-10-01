# Wave66：消息、构思、访客原稿恢复与限定微信验证

基线本地 `d94d3aa29c7b29f80392c8788311eed39ddfce12`、GitHub `52d8860d9decb55d985a467da8f2a15e65adc387`，同 tree `63e896f5bc08f4fbe59482b12ab6529cd30b3426`。三名实现者独占 messages INBOX、create IDEA、event PG01；两个实现者交叉审查另外的页面，root顺序操作共享微信工具/Git。遵照用户最新要求，并发推进，只验证修改范围，不跑全量、CI或新增样式镜像测试。

## 原稿与保护

完整 ZIP 原 HTML/PNG按实际有效 CSS px恢复，不从缩小长图猜数值。消息2张原inline、构思10张固定官方Material、访客12张原inline变体+2张准确Material，共26 SVG **7,894 B**；原玩家JPEG复用，不复制大图/图形库。图形声明、原child/XML/hash/色值与官方许可保留。

- INBOX：brand/title/三filter整体sticky，原32/16logo与操作、24标题、贴纸和原12筛选；真实优先卡p12/r16/40图盒/16未读badge。胶囊inset扣除容器已有20px。JS、95业务属性节点、CENTER/CHAT及长页保护区同字节。
- IDEA：原80orb、眼睛/反光/透明粒子与有效lime光晕、输入r24/p16/min168/send40、三灵感r18/p14/44图盒、原gradient固定tray。无效h-13不猜52px。仅草稿/profile相距8px的两helper常数修改；FORM/REVIEW后缀与业务字节保持。真实本地规则/手填/关闭类别提示保留。
- PG01：只在READY羽毛球普通访客details/no success/no confirmation启用；原poster4/4.8/max425、两准确轨迹/原JPEG/皇冠/球拍、叠层sheet−24/r32、40事实图盒、48主办标识及固定底动作。仅新增既有模式的native header geometry，其他业务JS逆还原同字节。host/member/generic/success/其他section受保护；未加原假人员/日期/地图/群聊。

独立审查发现6处确定source偏差并已限定修正：IDEA两处softpink=#FFF0F3、tag15/quote18实际行高；PG01副按钮21行高、复合text-[15px]+text-lg最终字号18/行高28（官方Tailwind3.4.17排序依据）。没有把原无效token随意变成设计值。

[消息实施](caper-messages-reference-ui-wave66-2026-10-02.md)、[独立A](caper-messages-independent-review-wave66-2026-10-02.md)、[IDEA实施](caper-create-idea-reference-ui-wave66-2026-10-02.md)、[PG01实施](caper-event-visitor-reference-ui-wave66-2026-10-02.md)、[独立B/C](caper-wave66-independent-source-review-2026-10-02.md)。每份来源/绑定/保护检查仅一次；四CSS/二CSS订正后只核改变处，不重跑已通过保护项。几何VM仅B3/C7场，不能代替实际原生布局。

## 限定微信实际结果

同步完整候选到隔离工程，除本机config.js/.DS_Store差异0；基础库3.17.2、402×874、状态54、capsule left308/right395、测试AppID、API3037。

| 分段 | 实际通过与边界 |
| --- | --- |
| 消息 | 26细分检查PASS/7交互记录/13.442秒：真实9通知/4未读/2优先行，原准确图形/几何及整个header滚动sticky；三filters、搜索输入/清空、CENTER往返、设置→真正可见授权区、第一WAITLIST_OFFER→真实个人页并同notice服务端OPENED。身份finally恢复。2截图；第二图证明sticky，优先卡在第一图。 |
| IDEA | 首段23检查通过后立即读取关闭卡message为空而失败，4.564秒，原pass=false保留。只补剩余9检查PASS/5.103秒：滚动使目标可见并等待实际异步提示，原输入保持、换一批、手填FORM及header返回、真实send调用本地规则API→FORM得到实际notes，再返回IDEA。无保存/发布；2截图。字体/源色值与header/tray维度已在首段通过，不重跑。 |
| PG01 | 首段13通过后SDK的text:last-child错误选到第一个标签，失败6.549秒；补选第二真实元素18/28、副按钮21、旧poster排除和当前地点复制等5检查通过，其后过早读clipboard失败，15.034秒。仅信息复制等待当前回调后1检查通过；随后showActionSheet mock报API不存在，6.585秒。最后仅剩余11检查PASS/20.712秒：运行时该API为undefined，实际more走既有fallback→同event求助表单未提交；实际确认开/取消恢复访客、无报名；真实host/member回看排除新visitor样式。2截图；未验证native菜单选择。 |

合计 **88条成功局部断言／19条交互记录**，不同分段、重复输入记录和只读角色回看不等于88功能或19独立按钮全项目通过。所有失败harness段、具体phase和原结果都保留；没有为错误selector/时序假设改产品。各段应用exception列表为空。

`showActionSheet`的mock/restore尝试与随后undefined只能说明此自动化时点及fallback，不能证明干净真机没有此API，不能计为菜单原生选项实点。Mac最终仍锁屏，native computer use已请求解锁但尚无新增实点。没有提交授权/举报/删除/报名/活动保存发布；消息OPENED为明确合成身份上的真实读取写入。

6截图已逐张查看；源几何、部分字形和受影响动作是本地证据，900/italic与其他手写角色仍需按完整字体来源继续核；不宣称全长同尺寸或全部39屏逐像素。

## 包体超限及必要修正

三页源净增50,005 B不能推编译预算。第一次CLI退出0，但实测主包 **2,098,454 B**，超2MiB **1,302 B**，明确不接受为预算通过。

[字体完整许可正文去重](caper-font-license-dedup-budget-wave66-2026-10-02.md)：两份OFL共同body4,303 B只存一次，分别拼接原版权前缀；资源模块190,570→186,228 B，原源码省4,342 B。root独立加载旧/新模块，五资源family/weight/Base64数组、前181,500 B完全相同，两份导出完整许可与原模块及官方docs逐字节相同。loader/API/UI没有改变，未重复5初始化VM或67字体检查。

去重及C两CSS订正后的preview退出0：总包3,102,347 B、主包 **2,094,089 B**、activity78,943 B、profile929,315 B；低于2MiB仅剩3,063 B。进一步按[只读预算审计](caper-main-package-budget-audit-wave66-2026-10-02.md)原字节迁移六份无运行引用的source JSON到docs，图形/字体/照片与运行代码不动；[迁移证据](caper-main-evidence-relocation-wave66-2026-10-02.md)保留完整映射和 byte/hash。最终完整 clone 同步差异0，再一次实际 CLI preview exit0：总包3,102,347 B、主包2,094,089 B（余3,063 B）、activity78,943 B、profile929,315 B，**与迁前完全相同，实际编译节省0 B**。40,291 B只代表原始源码净移出，不能计为下一批可用空间；并行继续查必要的实际压缩策略。移出纯来源文件未重复业务／UI测试。

## 证据与持续工作

[完整机器记录](caper-wave66-devtools-measurements-2026-10-02.json)保留全部harness失败、限定补测和包体超限原结果。下批[FORM/REVIEW/报名确认/成功](caper-next-flow-reference-gap-audit-wave66-2026-10-02.md)只有完整只读盘点：FORM实际caper_ai，pg04是REVIEW，pg04_s不属该四流程。另全局五Tab差距与主包方案只读审计继续；未实施部分不计通过。

自主目标继续进行。所有原稿页面／字形／全长逐像素与每个按钮的新一轮覆盖，正式AppID、HTTPS合法域名、订阅模板、真机、真人运营、三场真实受控活动尚未完成。本批仅必要凭证和cached差异检查，提交[skip ci]、GitHub同tree核对；不跑全量或CI。

## 提交前必要检查

37个冻结路径在最终整合前 byte/hash 核对一致；六 JSON 与 d94d3aa 原路径逐字节相同。最终 preview 前完整 clone diff0。凭证扫描已通过1225 tracked text／1 ZIP、562 binary跳过，cached差异空白检查0；后续仅为把根证据与独立B/C报告纳入明确staging重做必要扫描，不跑业务全量。原未跟踪开发包目录排除。提交使用[skip ci]，实际远端同tree与最新PR头另以工具回读。
