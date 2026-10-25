# 工作区业务编排

[源码](index.tsx)

useWorkspace 返回 WorkspaceModel，区域组件通过 Pick 限定消费字段。主区域只有一层 query/data/structure/ddl 页面标签。SQL 页共用编辑器和最新一批结果，对象操作打开独立结果页；关闭最后一页保留空状态，不自动新建。

## 范围、补全与请求

每页独立保存连接、库、表和 SQL。树高亮独立于右侧页面，单击/展开/双击不修改 SQL 范围；对象操作携带完整 connectionId/db/table。openConnection 只管理元数据，折叠不关闭；关闭取消该连接共享请求和缓存，清空相关 SQL 页范围但保留草稿与已有结果。删除/编辑不修改其他连接的范围。

连接保存后刷新连接列表，并展开其所属分组；分组仅整理树结构，所有元数据和查询请求仍以原始连接 ID 隔离。

选连接后提供当前连接的数据库补全；选库自动 loadTables 并共用对象缓存，补全表/视图及已加载字段，defaultSchema/defaultTable 与当前页一致。异步数据按连接隔离，范围变化只切换消费方；关闭/刷新取消旧代请求，迟到结果不能重新打开连接。数据库成功加载时只校验保存范围是否仍有效，不自动执行 SQL。

完整草稿或选区由 splitSQLStatements 完整扫描，再顺序调用现有只读单语句接口。整批固定页 ID、连接/库、运行锁与 AbortController；每条独立保存结果和历史。失败或取消停止后续发送，保留已完成结果并提示未执行数量；请求不传 limit/allowWrite，不声称此前执行被回滚。

RunState.statements 保存该批逐条输出，resultViews.resultIndex 保存当前结果；selectResult 重置筛选/分页。顶部 Tab 与结果 Select 根据该页选中语句的状态着色，切页后保持。运行中可切已有页面，禁止关闭和新增；关闭同步释放该页结果、视图和编辑器布局。

## 本地恢复

useWorkspacePersistence 以 AES-GCM 加密的 IndexedDB 快照保存 tabs/activeTab、范围/SQL、runs/resultViews、编辑器选区和滚动、对象树展开/选中/搜索/滚动、结果区高度及打开连接 ID。只传页面白名单字段，不保存连接密码/表单凭据；顶部展示正在保存/已加密保存/错误状态。

sidebarWidth/setSidebarWidth 管理左侧对象栏偏好宽度，纳入同一加密快照；旧快照缺少该字段或不是有效数字时使用 272px，展示宽度由 useSidebarResize 根据窗口边界约束。

进入先恢复快照，再允许编辑；没有快照时为空，兼容迁移旧草稿。恢复时仅重连之前打开的连接、加载必要的库表元数据，SQL 与结果直接取本地记录，不自动查询数据。刷新打断的执行标记 interrupted，完成结果保留并提示手动重跑。元数据加载仍使用连接缓存及取消边界。

## 历史与编辑

useQueryHistory 加密保存各连接最多 50 条记录。入口仅位于 SQL 页，打开时重置搜索，QueryHistory 以连接 ID 重挂载。loadHistory 清理记录里旧的来源标记后，追加到当前编辑器末尾并标注一行 -- 历史记录，不新增页、不切库、不执行；CodeMirror 事务保留撤销。来源标记不进入历史 SQL，重复执行仍保留各次执行信息。

右键打开时捕获选区快照，runSelectedSQL 不回退到整页；工具栏和 Ctrl+Enter 优先执行选区，无选区则完整草稿。导入本地 SQL 新建查询而不执行，exportCurrentSQL 原样导出完整草稿。onEditorReady/onEditorUpdate/rememberEditor 负责恢复并保存编辑位置。
