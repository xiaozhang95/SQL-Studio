# 前端回归

query-output.test.mjs执行真实useQueryMessageScroll，验证新增回执及ResizeObserver高度变化跟随底部、滚轮/滚动条/键盘向上阅读暂停、返回底部恢复、跨分页与手动分页、新批次重置、静态历史从顶部阅读及卸载清理。使用受控DOM/Observer替身，不执行SQL；浏览器另验证真实消息区滚动与50条分页边界。

agent.test.mjs的会话列表刷新回归覆盖当前项缺失、空列表、列表重排、草稿/展开与正文保留、最新响应优先、迟到失败与手动改选隔离；后台不创建默认会话、不读取其他正文。显式删除当前项仍确保并激活默认会话，删除其他项不自动切换。请求使用受控替身，不删除真实会话或访问数据库。

共享侧栏宽度的浏览器检查使用真实App、useSidebarWidth和两页组件，全部API由隔离虚构配置替换；覆盖旧工作台宽度恢复、工作台到Agent同步、Agent拖拽到工作台同步、双击重置、Home/方向键调整、保存后两页直接刷新恢复及亮暗主题。隔离配置保存验证不代表真实后端磁盘写入实测。

agent.test.mjs覆盖裸JSON/围栏JSON与文字混排、多个表格、字段顺序、字符串转义、重复列、精确数值及truncated保留；校验未闭合流式表格、行列错误与代码示例边界。实际AnswerMarkdown服务端渲染验证加粗、行内代码、列表、安全链接及HTML/图片不执行；浏览器另检查实时/结束状态、亮暗主题和窄窗口。不请求真实模型或数据库。

使用 Node 原生测试运行器，不保留根目录 scripts 包装入口。

真实集成测试通过 `integration-steps.mjs` 的 `step(context, name, run)` 等待每个子测试回调实际完成，再继续依赖该结果的步骤或进入 finally 清理。当前 Node 24.2 环境中，单独 await context.test 不能保证这一顺序；不得在子测试仍运行时删除临时库或连接。回调失败同时标记子测试失败并终止依赖流程，finally 仍清理本轮对象。

`node --test tests/table-navigation.test.mjs` 执行实际对象页面导航及 WorkspaceStore 保存逻辑，覆盖 MySQL/PostgreSQL 表与视图双击后的页面复用、保存请求契约，以及查询/结构/DDL/设计页范围隔离。view 只用于对象管理，不进入页面与执行范围；使用虚构元数据和请求替身，不访问业务数据库。

`node --test tests/export-availability.test.mjs` 执行实际 useDataExport 发起逻辑，以替身文件选择器检查不可用目标在数据库、Schema、表及两种内容模式下均不创建导出状态或文件；发起时再次判断，重新打开后允许导出。浏览器另核对菜单禁用、摘要两列及窄窗口单列，不代表真实数据库导出验证。

- `pnpm test:sql`：MySQL 标识符、表预览、语句拆分、引号/注释边界、历史标记去重，以及结果 SQL 定义/语句列识别和普通元数据列排除。
- `node --test tests/structure.test.mjs`：模块入口、README、原生样式归属及本地文档链接，已纳入 `pnpm lint`。不读取 data、凭据、依赖或构建目录；后端依赖边界由原生 Go 架构测试独立检查。

`pnpm test:storage` 执行当前服务端用户配置测试，覆盖缺失文件初始化、串行保存、修订与冲突。

页面恢复、主题、树布局、SQL 补全与结果状态联动另用虚构接口做浏览器验证。

query-output.test.mjs 验证 104 条批量执行回执不生成数据结果导航、混合查询保留原语句索引、空结果/RETURNING、失败默认消息与当前对象单结果；浏览器另检查摘要分页、超过 8 个结果集的下拉切换与结果内容。

- `pnpm test:objects`：库表操作 SQL 目标转义、默认值/SQL mode、类型与表达式注入拒绝、特殊字段保护及差异 ALTER；无数据库访问。

数据编辑回归：`node --test tests/data-editing.test.mjs`，覆盖精确主键、联合主键、NULL/空字符串、标识符/值注入边界及生成列限制，不访问真实数据库。

用户配置回归：node --test tests/user-state.test.mjs，覆盖服务端优先、当前格式读写、串行修订及冲突，不访问真实用户文件。

对象树回归：node --test tests/object-tree.test.mjs，验证数据库及分类节点双击只展开/折叠且不打开页面、Schema/表的原始双击入口、多连接及特殊名称节点身份、复合索引顺序、前缀、降序和表达式说明；浏览器使用独立端口和虚构数据检查，不连接真实数据库。

连接恢复回归：`node --test tests/connection-recovery.test.mjs`，执行真实元数据 hook、菜单生成和已打开列表计算，使用替身请求验证恢复失败不再持久化为已打开、失败可关闭/重试、加载中关闭取消及迟到响应隔离、关闭失败保留状态和多连接隔离；不访问真实数据库或用户配置。

scope-close.test.mjs 覆盖同名库跨连接隔离、所有关联查询汇总、库级取消及新请求代、保存 SQL 成功等待、取消与写入失败。浏览器用虚构接口检查保存/取消/关闭及关闭失败保留窗口。

workspace-transitions.test.mjs 验证新增对象不修改布局、删库按连接及数据库隔离；成功刷新库列表会清理已消失库的全部展开/选中记录，空列表、特殊名称、同名库重建和其他连接隔离均覆盖。explorer-tree.test.mjs 验证万表数据的折叠分支不生成后代、字段/索引按自身展开生成、首次滚动恢复等待元数据。浏览器另验证外部删库后刷新、同名库重建仍收起和布局恢复，使用隔离临时库；万表验证使用独立虚构接口。

对象树收起动画回归需在动画仍挂载旧节点时读取可见行：反复收起/展开字段、索引、表和数据库，标题应始终保留名称与图标，不能出现 JSON 内部 key；同时检查亮暗主题及操作后的最终展开状态。

history-completion.test.mjs 覆盖旧历史每连接截取最新 50 条、删除归属隔离、AI 万表上下文选择与限长，以及原生 SQL 库前缀/别名字段补全。浏览器使用虚构连接和模拟 AI，检查历史追加/删除落盘、输入防抖、Tab 优先本地补全、AI 接受/取消和继续输入中止请求，不调用真实模型。

切库回归：`node --test tests/use-database.test.mjs` 执行实际 executeSQL 编排、替换请求和状态，验证多次 USE 的后续请求/历史/结果范围、页面隔离、失败停止和取消不切库；不连接业务数据库。

PostgreSQL 回归：`node --test tests/postgresql.test.mjs` 检查美元引号/E 字符串/嵌套注释、历史保护、schema 同名表身份、SQL 注入边界、精确主键与 NULL 数据编辑；不访问网络。

PostgreSQL 属性与数据转储：`node --test tests/postgresql-management.test.mjs` 覆盖元数据解码、属性范围/原值核对/注入拒绝、序列精度、IDENTITY、生成列、BYTEA及截断拒绝。`postgresql-management.integration.test.mjs` 复用 SQLDESK_SQL_WINDOW_INTEGRATION/SQLDESK_TEST_API/SQLDESK_PG_PASSWORD 开关，建立两个随机 sqldesk_feature_ 临时库，真实执行属性修改与跨库还原、对比数据并检查后续自增；finally删除临时库和连接。浏览器另验证实际编辑入口、预览/保存、下载内容及亮暗主题。

真实 SQL 窗口回归：`node --test tests/sql-window.integration.test.mjs` 默认跳过。先用独立 SQLDESK_STATE_DIR/SQLDESK_DATA_DIR 启动本地后端，再设置 SQLDESK_SQL_WINDOW_INTEGRATION=1、SQLDESK_MYSQL_PASSWORD、SQLDESK_PG_PASSWORD；SQLDESK_TEST_API 可覆盖接口地址（默认 http://127.0.0.1:18080/api）。测试执行实际 executeSQL 编排和引擎切分器，经 HTTP 访问本机 3306/root 与 5432/postgres；只创建随机 sqldesk_window_ 临时库/schema、临时连接，finally 清理。覆盖精确值、多结果、错误停止、取消后重跑、行数限制、MySQL USE/SET/建表/重建表/INSERT/UPDATE/DELETE/ALTER/RENAME/TRUNCATE/DROP、写入失败停止和 API 默认读取边界、PostgreSQL DDL/DML/RETURNING 与美元引号。它替换 React 状态并断言请求、逐条结果及历史，不替代浏览器点击、选区或快捷键检查。凭据只从环境变量读取，勿把真实密码写入测试文件或报告。

explorer-tree.test.mjs 额外验证 PostgreSQL 空 schema、schema 分类隔离、同名表的短标题/完整操作目标和搜索，MySQL 万表按展开构建的行为保持不变。

Schema 回归覆盖结构列表拆列、旧记录迁移、同名/特殊标识符、指定 schema 下补全、AI 引用与历史/刷新请求范围；后端用同一物理连接的替身检查 search_path 参数化及只读边界。

export-stream.test.mjs 覆盖 SSE UTF-8 跨块/心跳/完成和失败、原生文件提交/放弃、两种引擎复合主键删除和 PostgreSQL 外键延后/引号表达式。后端 mysql/postgresql export_test.go 通过真实 database/sql 扫描流程及替身驱动验证6001行分批、精度/二进制、只读及资源释放；HTTP export_test.go 验证SSE事件和显式目标。均不代表真实数据库导出回灌验证。

workspace-split.test.mjs 覆盖100页轻量索引、仅活动页读取、布局/草稿更新不传结果、只读范围草稿不常驻、持久化成功后释放基线，以及冲突、取消和损坏页面保护。workspace-performance.test.mjs 继续验证保存队列背压；原全量工作区序列化实现已移除。真实Go迁移/CAS/失败保留测试见后端statefile/workspace_test.go及httpapi/workspace_test.go。

workspace-performance.test.mjs 还验证编辑缓冲的延迟全文读取、连续更新截止提交、切页/导出同步、位置更新不读SQL、关闭取消及分页原始行key/NULL搜索/全量CSV。浏览器另验证立即运行、选区快捷键、切页保留和历史事务，替身不代表真实数据库执行。

MariaDB：`node --test tests/mariadb.test.mjs` 检查 MariaSQL 扩展、可执行注释、USE、默认字符串/NULL/表达式及排序规则别名，均不访问数据库；真实驱动/HTTP 回归见后端 tests/integration/mariadb_test.go。

agent.test.mjs中的内联写入确认测试执行真实useWriteConfirmation控制逻辑，替换React状态与fetch，覆盖等待不提交、一次性ID/决定请求、重复提交、失败重试/取消、中止/结束/卸载清理和迟到响应隔离。浏览器另以真实hook、Transcript和WriteConfirmation组合验证卡片、SQL只读预览、按钮禁用、错误、确认/取消/停止与亮暗/窄窗口；确认接口使用隔离替身，不访问真实数据库。

Agent历史切换回归使用真实useChat控制逻辑与替身接口，覆盖连续选择取消、迟到响应、卸载、失败重试、重复选择和首次内容加载时改选；restoreEvents覆盖12,000条事件、分批取消、输入不可变及工具/增量/错误语义。这些属于控制逻辑测试，不代表真实浏览器性能或数据库验证。

单轮对话切换测试覆盖滚动到边界后留在当前轮、手动切换及加载时卸载旧轮、最新回复跟随、连续导航替换、新提问/写入确认回到最新轮和卸载清理；浏览器另核对实际滚动及视觉效果。

workspace-pages.test.mjs验证提交前标签校正：未知/空/有效schema、对象操作期、连接隔离、非查询页保护、SQL保留、标题迁移和幂等引用。

page-title.test.mjs 验证查询页标题随所属数据库/Schema 变化、清空范围回退、多页与恢复隔离、导入文件名及原始 title/SQL 保留、旧执行来源不覆盖当前标题，以及非查询页标题保持原值。不执行 SQL，不访问用户配置。

desktop-title.test.mjs 转译真实 DesktopTitleBar 并检查渲染内容与 document.title：切页/切库使用最新标题，空工作区回退，AI 页隐藏，后台工作台不覆盖，浏览器不改写。主题 token 和 effect 调度使用替身，不代表原生 Electron 窗口视觉检查。

review-fixes.test.mjs 覆盖快捷键可见/目标/模态框/组合键边界、分页历史及恢复副本取消与写入失败；workspace-split 追加 CAS 连续冲突保留内容、批次最终结果一次上传及过期运行标记提交。SQL 编排测试读取 useQueryExecution 的实际 executeSQL。以上均为替身/单元测试，不替代真实 CodeMirror、HTTP/数据库与下载验证。

AI 配置回归：node --test tests/ai-settings.test.mjs。覆盖仅新配置格式、模型显示名称、行内连接测试、列表不提供启用选择、多模型去重、发现不自动选择，以及使用处选择和配置保存保留补全偏好。使用真实 hook 与替身请求，不访问 DeepSeek 或数据库；测试代码随行为同步不代表已执行。
