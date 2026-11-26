# 执行历史抽屉

界面固定文案通过共享 useTranslation 跟随已保存语言切换；SQL、用户输入和数据库返回内容按原文展示。

执行错误通过共享 ErrorNotice 在历史抽屉记录的详情内展示。取消记录使用独立状态，可按状态筛选；旧记录中的已取消文案按同一状态显示。

[组件索引](../README.md) · [源码](index.tsx)

model 提供当前连接 history、clearHistory、historyOpen/setHistoryOpen、搜索值、connections、connectionId、connection、running、loadHistory。useQueryHistory 按当前 SQL 页面的 connectionId 读取独立存储，每连接最多 50 条；左侧树选择不影响历史。

查询编辑器和 Redis 命令行工具栏提供入口。连接变化时按 key 重挂载，隔离筛选和详情展开。打开时清空搜索并回到顶部。同一连接跨库记录均可见。清空弹框显示当前连接及全部记录数，确认后调用 `clearHistory(connectionId)`。搜索和表格筛选只影响显示，清空范围为该连接的全部历史。

抽屉首次打开前不预渲染历史编辑器；只读 SQLPreview 复用相同内容，避免历史高亮随查询输入反复重配。

表格与载入按钮采用 Ant Design 标准尺寸。全部已保存的匹配记录通过原生 Table 虚拟滚动连续浏览，只挂载视口附近的行。支持状态筛选、时间和耗时排序，以及 SQL 和数据库搜索。搜索时回到顶部。数据列可拖动表头右缘调整宽度，固定操作列保持原宽，文字统一左对齐。详情默认收起，可查看和复制完整 SQL。

抽屉宽度受视口限制，搜索和表头固定在表体上方。useTableViewportLayout 测量抽屉可用空间并在打开动画结束后重新绑定观察。长 SQL 和展开详情由虚拟表实际测量行高，双向滚动留在表体。

载入调用 loadHistory，直接在当前 SQL 页末尾追加 `-- 历史记录` 注释和 SQL；已有内容保留，空内容同样标注来源。不新增标签、不修改当前连接/库、不自动执行；连接已删除或正在执行时禁用载入。

额外必传 themeMode:ThemeMode。列表 SQL 和展开详情统一使用 SQLPreview compact 高亮，只有同排复制图标，不重复 SQL 标题或复制文案。SQL 全文自动换行并按内容展开，不限高、不产生内部滚动；长记录由外层表体滚动。复制使用完整原始 SQL（保留换行/注释）；方言按记录 connectionId 查找当前连接类型，旧连接已删除时使用默认适配器。

抽屉标题依次显示 20px 引擎图标、当前连接名称和「执行历史」。图标按当前连接的对象快照展示连接状态，尺寸与工作区连接选择器一致。长名称省略并可悬停查看全名。没有当前连接时显示「执行历史」。

PostgreSQL 历史增加 Schema 列和 schema 搜索，未记录/未指定展示默认搜索路径；载入仍只追加 SQL，不自动改换当前连接、数据库或 schema。

清空历史和载入编辑器使用 ToolbarButton 图标入口，Tooltip 和 aria-label 提供名称。Redis 历史使用命令载入按钮。

空态图标复用公共 EmptyStateIcon，统一主题色与尺寸。
