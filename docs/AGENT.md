# SQL Studio 数据库 Agent

数据库Agent已合入现有前后端。构建sql-studio-frontend后，从sql-studio-backend运行go run main.go，打开默认8080页面，在侧栏底部「系统设置」中选择「Agent」。也可直接打开/#agent。在Agent的「系统设置」中选择「工作区」即可返回，原查询草稿保留。

## 界面

实际使用@ant-design/x 2.5.0的Conversations、Bubble、Sender和Think；参考[官方项目](https://github.com/ant-design/x)与[Sender接口](https://ant-design-x.antgroup.com/components/sender)。空列表默认创建并选中一条“新建会话”；顶栏左侧新建立即显示并保存，历史支持重命名和确认删除。删除最后一条后重新创建默认会话，手动名称不被后续问题覆盖；底部蓝鲸模型菜单的“DeepSeek 配置”直接复用workspace的配置弹窗、表单hook和ai配置分区，不单独维护Agent Key。保存/移除及窗口回焦会刷新Agent配置状态，workspace配置一次即可使用。只读标签、模型与发送在输入区底部。Enter发送，Shift+Enter换行，中文候选确认不提交。

思考与执行过程分别为标题可折叠的内容卡片，展开状态随会话布局保存；折叠不删除原始记录或查询结果。结果独立展示表格，保留重复列、精确数值文本、NULL、分页和SQL预览。亮暗/跟随系统复用SQL Studio全局主题。内容区一次展示一轮，默认最新；点击右侧上一轮、下一轮按钮或左侧刻度切换，也可通过问题搜索定位，切换时显示加载状态。回到最新消息按钮位于输入框上方中央。单轮可正常滚动，上滚阅读不被流式片段拉回；新提问回到最新轮，轮次切换不重新读取会话或执行SQL。

## 后端和数据

- modules/agent：上下文、会话、工具白名单和流式编排，只依赖model/agent与消费接口。
- app：Agent复用已保存连接配置，使用独立引擎客户端和metadata实例；query通过WithExecutor隔离工作台连接开关、取消及请求状态，不在进程内绕行HTTP。SQL窗口与Agent仍共用4个查询并发槽位，Agent读取固定allowWrite=false、limit=100；完全访问写入逐次确认后才使用allowWrite=true。
- deepseek/agent：官方思考SSE和工具调用传输。SQL续写/优化保留现有deepseek客户端，共用同一ai配置；没有第二份运行时Key配置。
- agentstate：StateDir/agent下保存conversations/index.json、id-revision.json及layout.json；恢复不调用模型/数据库。完整原文与送模上下文分离。

每轮180秒，不限制主模型调用轮数和工具操作次数。按1M窗口采用700000保守输入上界，较早完整轮次生成事实摘要，保留近期完整工具配对和reasoning_content；估算不是精确tokenizer。单工具HTTP时代的256KiB界限在进程适配器中保留，模型上下文单工具32KiB；超限明确提示。新SSE路由每10秒心跳，单独续期写截止时间，断开取消并完成最终检查点，普通HTTP超时不放宽。

输入按 UTF-8 字节计算。64 KiB 以内直接发送，超过 64 KiB 至 256 KiB 时先确认，超过 256 KiB 时保留编辑框中的原文并提示分段。工具结果超过 32 KiB 时，先显示已取得的结果，经确认后才将它发给模型。上下文可压缩时，先确认再生成较早轮次的摘要。只读查询结果超硬上限时可自动缩小范围一次，其他可恢复读取失败由用户决定是否重新规划。不可恢复错误结束本轮，已完成的操作保留。

Agent的每次数据库操作使用独立物理连接，成功、失败或取消后在返回前释放，不等到整轮聊天结束。工作台连接/数据库的打开关闭不影响Agent，也不被Agent操作改变；会话只保存目标和发现记录，不持有数据库连接。等待模型生成和写入确认期间不保留数据库连接，下一次操作按当前配置重新建立。

接口位于/api/agent，见[API](API.md)。Agent布局与SQL工作区布局独立，但共用同一Go进程和全局外观。API Key只由后端读取，前端不回填、不写浏览器持久化；存储方式沿用SQL Studio的ai分区。

## 全新数据

独立sql-chat-agent目录及旧会话、布局、Key已删除，不做迁移、不读取旧目录，也不提供旧目录环境变量。新Agent在SQL Studio的StateDir/agent创建记录，Key与模型共用SQL Studio现有ai分区。

## 验证

自动检查与隔离浏览器验证记录见[Agent验证](AGENT_VERIFICATION.md)。真实DeepSeek账号和真实数据库联调单独报告，替身通过不代表真实服务通过。

Agent操作模式：POST /api/agent/chat 增加mode（readonly默认，write为完全访问模式，允许非删除数据及结构操作）。任何模式拒绝DELETE/DROP/TRUNCATE/REPLACE及删除性结构操作；删除仅提供命令及风险提示，不自动执行。刷新和往返工作台恢复上次确认的模式。支持单条INSERT/UPDATE/CREATE/ALTER/COMMENT及表达式和子查询；多语句、存储程序、动态SQL不执行，以防绕过删除限制；取消不保证回滚。查询回答提示生成真实二维JSON表格，前端校验后展示，支持导出当前已加载结果xlsx，截断明确提示。


写入逐次确认：execute_write通过write_confirmation SSE事件暂停，携带approvalId/connection/database/objects/sql。POST /api/agent/write-confirmation提交allow，确认ID不可重复使用；未确认、取消、超时、断开不执行，取消结束本轮。服务端生成明细并绑定本次目标/SQL，不接收前端替换SQL。确认独立等待最多5分钟，等待期间暂停本轮执行计时；恢复历史不重新显示已过期确认卡片。模式提示不替代逐次确认。

完全访问模式的新增、更新及非删除结构操作保留逐次执行确认，前端改为在当前回复下方显示卡片，不使用执行确认弹窗。卡片显示连接、数据库、涉及对象和完整SQL，提供确认/取消；提交期间禁用重复操作，失败在卡片内提示。停止生成、超时、断开和本轮结束清除待确认卡片，历史不会重新发起确认。

Agent SQL防线：sqlpolicy.go在工具层及app进程适配层校验单语句、读取类型、普通表达式函数及目标范围；禁止USE/会话设置、锁/等待、文件操作、未知存储/UDF函数、删除性函数及管理账户/扩展/服务器配置。MySQL/MariaDB限定当前数据库，PostgreSQL保留当前物理库内schema限定名，跨库函数不允许。完全访问仍支持非删除DDL、表达式/子查询及PostgreSQL ON CONFLICT DO UPDATE/NOTHING。确认对象由同一词法扫描提取全部源/目标对象，不再仅正则提取首个名称。

此检查是保守的受支持SQL子集，不是完整SQL解析器或数据库权限沙箱；未知函数应改写或由用户自行审阅执行。既有触发器、外键级联、函数重载、运算符、视图规则、FDW与数据库权限配置仍可能影响实际行为，生产环境需使用最小权限并审查这些配置；不宣称静态规则能阻止所有数据库内间接副作用。普通SQL工作区继续沿用原有能力。

本轮全面归档检查见[2026-11-03 Agent归档报告](AGENT_ARCHIVE_2026-11-03.md)，历史增量验证日志保留原验收时间与边界。
