# 页面结果展示

[组件索引](../README.md) · [源码](index.tsx)

QueryResults 接收 model（当前页 run/result、连接信息、运行状态、筛选、分页、结果索引与高度及其回调）和 themeMode:ThemeMode。没有 run 返回 null。query 页输出与编辑器上下共存且可拖动高度，data/structure/ddl 页输出铺满可用区域。

[输出导航](../resultTabs/README.md) 将“消息 / 摘要 / 结果 1 / 结果 2……”置于一层，结果项不再内嵌 SQL 标签；默认展示最后完成结果，执行开始且没有输出时展示消息。消息/摘要视图选择只保存在组件内，跨主页面切换后回到结果；结果索引仍由 selectResult 控制并加密保存。查看消息/摘要不修改结果索引或筛选分页；选择另一条结果调用 selectResult 重置筛选分页。

[消息](../queryMessages/README.md) 按实际执行顺序列出 SQL、状态和耗时；[摘要](../querySummary/README.md) 汇总成功/失败数量、起止时间及运行时间，支持仅显示错误。二者的执行 SQL 经 [sqlPreview](../sqlPreview/README.md) 只读高亮和复制，不用编辑器草稿冒充。旧记录缺少 SQL 或耗时时明确提示未记录。

结果视图保留查询耗时、筛选、CSV、错误与空结果说明。Table 使用原生 small，字段名和类型垂直展示，NULL 使用次级文字 (NULL)，二维数组按列索引保留重复列和大整数文本；结构列表按类型显示对象图标。useTableViewportLayout 分配表体高度，表体双向滚动，外部分页每页 50 行，固定在表体外并复用 tablePaginationDefaults。CSV 导出全部筛选行。翻页、筛选和结果更新回到表体顶部，切换视图重测高度。

重复执行替换本批输出，失败/取消保留已完成结果。interrupted 提示刷新中断；恢复不自动执行 SQL。执行中对象页保留取消按钮，查询页取消按钮归编辑器工具栏。主页面状态色始终跟随工作区选中结果，消息/摘要切换不影响它。

DDL 页的原始建表语句使用 SQLPreview compact 高亮并提供同排复制图标，保留完整换行和定义，不进入普通单元格省略样式；编辑器不设内部限高，由结果表体统一滚动，筛选和 CSV 导出仍使用原始结果值。普通字段结构和查询数据仍保持原表格展示。
