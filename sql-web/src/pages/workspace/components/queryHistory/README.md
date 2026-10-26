# 执行历史抽屉

[组件索引](../README.md) · [源码](index.tsx)

model 提供当前连接 history、clearHistory、historyOpen/setHistoryOpen、搜索值、connections、connectionId、connection、running、loadHistory。useQueryHistory 按当前 SQL 页面的 connectionId 读取独立存储，每连接最多 50 条；左侧树选择不影响历史。

仅 SQL 查询页工具栏提供入口，独立结果页不展示。连接变化时按 key 重挂载，隔离分页、筛选和详情展开；打开时清空搜索。同一连接跨库记录均可见，不按显示名称筛选。清空确认后调用 clearHistory(connectionId)，只清空此连接。

Table 采用原生 small、8px 单元格内边距、小号载入按钮，每页 10 条；支持状态筛选、时间/耗时排序，SQL/数据库搜索。详情默认收起，可复制完整 SQL 和错误。抽屉搜索、表头与分页固定，useTableViewportLayout 只允许表体滚动；长 SQL 不推动分页，横向滚动和固定操作列保留。

分页使用 tablePaginationDefaults，与查询结果统一原生默认尺寸、32px 页码、“共 X 条”文案和底栏间距/分隔线，不再随 small Table 自动缩小。保留原生 Table 对筛选、排序后总数与当前页的管理。

载入调用 loadHistory，直接在当前 SQL 页末尾追加 `-- 历史记录` 注释和 SQL；已有内容保留，空内容同样标注来源。不新增标签、不修改当前连接/库、不自动执行；连接已删除或正在执行时禁用载入。

额外必传 themeMode:ThemeMode。列表 SQL 和展开详情统一使用 SQLPreview compact 高亮，只有同排复制图标，不重复 SQL 标题或复制文案。列表预览限高 32px、详情限高 240px，复制始终使用完整原始 SQL（保留换行/注释）；方言按记录 connectionId 查找当前连接类型，旧连接已删除时使用默认适配器。
