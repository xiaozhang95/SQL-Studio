# 页面结果展示

[组件索引](../README.md) · [源码](index.tsx)

QueryResults 接收 model（当前页 run/result、连接信息、运行状态、筛选、分页、结果索引与高度及其回调）和 themeMode:ThemeMode。没有 run 返回 null。query 页输出与编辑器上下共存且可拖动高度，data/structure/ddl 页输出铺满可用区域。

[输出导航](../resultTabs/README.md) 将“消息 / 摘要 / 结果 1 / 结果 2……”置于一层，结果项不再内嵌 SQL 标签；默认展示最后完成结果，执行开始且没有输出时展示消息。消息/摘要视图选择只归属当前页面的当前输出版本；重新运行或刷新产生新输出时，旧选择立即失效，回到最后完成结果。结果索引仍由 selectResult 控制并加密保存。查看消息/摘要不修改结果索引或筛选分页；选择另一条结果调用 selectResult 重置筛选分页。

[消息](../queryMessages/README.md) 按实际执行顺序列出 SQL、状态和耗时；[摘要](../querySummary/README.md) 汇总成功/失败数量、起止时间及运行时间，支持仅显示错误。二者的执行 SQL 经 [sqlPreview](../sqlPreview/README.md) 只读高亮和复制，不用编辑器草稿冒充。旧记录缺少 SQL 或耗时时明确提示未记录。

结果视图保留查询耗时、筛选、CSV、错误与空结果说明。Table 使用原生 small，字段名和类型垂直展示，NULL 使用次级文字 (NULL)，二维数组按列索引保留重复列和大整数文本；结构列表按类型显示对象图标。useTableViewportLayout 分配表体高度，表体双向滚动，外部分页每页 50 行，固定在表体外并复用 tablePaginationDefaults。CSV 导出全部筛选行。翻页、筛选和结果更新回到表体顶部，切换视图重测高度。

重复执行替换本批输出，失败/取消保留已完成结果。interrupted 提示刷新中断；恢复不自动执行 SQL。执行中对象页保留取消按钮，查询页取消按钮归编辑器工具栏。主页面状态色始终跟随工作区选中结果，消息/摘要切换不影响它。

DDL 页和普通查询中的 SQL 定义/语句列通过 DatabaseAdapter.isSQLColumn 识别，统一使用 SQLPreview compact 高亮并提供同排复制图标，保留完整换行和定义，不进入普通单元格省略样式。覆盖 SHOW CREATE TABLE/VIEW/DATABASE/PROCEDURE/FUNCTION/TRIGGER/EVENT、SHOW TRIGGERS、information_schema 定义列及 SQL 语句记录列，具体列名见引擎 resultSQL 模块。普通查询 SQL 列宽 520px；所有 SQL 文本按内容完整展开并自动换行，不限高、不显示内部滚动条，长结果只由外层表体滚动。复制、筛选和 CSV 导出均使用完整原始值；NULL、空值和普通字段保留原展示，数据页仍可双击编辑。

data 页面支持双击单元格，由 [useDataEditing](../../hooks/useDataEditing/README.md) 加载元数据并使用 [dataCellEditor](../dataCellEditor/README.md) 编辑。保存显式写入且重读结果；普通 SQL 结果、视图、无主键表以及不支持字段保持只读。

数据页顶部统一保存所有暂存修改或放弃修改；已改单元格由 data-cell-dirty 类名标记，主题警告背景集中在 app.scss，输入区不再展示独立保存按钮。

保存/放弃修改采用 SaveOutlined/UndoOutlined 图标，保存文字不显示计数；点击编辑区域外部恢复文本并保留暂存。

顶部新增行按钮将待插入行显示在第一页最前方，单元格默认显示“(默认)”，双击输入。行号列叉号可移除尚未保存的新行，顶部保存统一提交，放弃修改同时清空新增行。

新增行改为常驻 newRowCell 表单，输入与默认值/指定值/NULL 下拉并列管理；不再渲染 undefined 文本或要求双击。

结果工具栏增加刷新：同页刷新当前查询结果/表数据/结构/DDL；未保存修改时禁用，防止覆盖暂存。

结果工具栏不显示查询耗时；执行耗时仍保留在消息、摘要及历史记录中。

没有结果列的成功响应只显示执行成功及影响行数，不渲染 Table、筛选、CSV、分页或重执行工具栏。以 columns.length 判断展示，兼容旧 isQuery=true 但无列的记录；SELECT 有列但零行仍保留表头和查询空态。
