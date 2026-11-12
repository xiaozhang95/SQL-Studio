# 连接与库表元数据缓存

[源码](index.ts)

## 调用与返回

`(connectionId: string, database: string, onDatabasesLoaded: (id: string, databases: string[]) => void)`；参数只确定当前查询消费的范围，不自动发起连接。

返回 snapshots（按连接 ID 的 loading/connected/error、库列表、表缓存、structures 和错误）、openConnection、closeConnection、refreshConnection、loadTables(database, connectionId?)、loadStructure(database, table, connectionId?)，以及当前范围的 connected、databases、tables、currentTables、loading、tablesLoading、error、tableError。

## 生命周期与边界

各连接独立维护请求控制器、库表缓存和并发去重；展开连接显式加载库列表，成功后标记 connected，即使列表为空也表示连接通过。加载失败保留原因，可重新打开重试。切换查询范围不清除其他已打开连接的缓存，也不自动连接保存的草稿。

loadTables 仅访问已打开连接；按连接/库缓存和去重，树箭头或双击连接/库节点时触发，选择文本本身不请求列表。关闭/刷新连接会取消并废弃该连接的所有旧代请求，迟到响应不能重新点亮节点或回填缓存；卸载取消全部请求。关闭不删除本机保存的连接，也不发送数据库写入。

onDatabasesLoaded 仅在当前请求代有效且库列表成功返回时触发，用于工作区校验草稿范围并清理已消失数据库及后代的树展开/选中记录；调用方提供稳定回调。加载中、失败或已取消的旧请求不得用空列表清理布局。关闭由工作区清空相关查询范围，缓存 hook 只管理元数据和请求。

loadStructure 将字段和 DDL 作为一份结构缓存，按连接与 JSON 编码的库表身份去重；structures 保存已完成的结构数据，失败不缓存，允许重试；不参与库/表图标颜色判断。范围变化时消费方废弃旧范围结果，共享请求可继续完成；关闭或刷新连接统一取消共享请求并清缓存，旧代结果不能回填。

查询页选择库也会调用 loadTables 供表/视图补全，与树的展开请求共享缓存和并发去重；不改变树选中或展开。恢复工作区时，仅按保存的打开连接 ID 重建元数据会话，不持久化数据库会话或自动执行 SQL。

loadTableDetails(database, table, connectionId?) 返回 Promise<TableDetails>，展开表时并行读取字段与索引。snapshots.details/detailErrors 按 JSON 库表身份保存完成结果与错误；会话内并发去重，成功缓存、失败允许重试。与 loadStructure 复用已完成字段；索引失败不影响旧 DDL/补全流程。关闭、刷新连接或卸载会取消并废弃旧会话，迟到响应不能回填；详情不持久化，也不读取表数据。

closeConnection/closeDatabase 为异步操作：先取消对应前端元数据请求，再等待 session 关闭接口确认底层驱动资源释放，最后清理缓存。库级请求使用独立请求代，其他库不受影响，迟到响应及旧 finally 不能覆盖或删除新请求。loadTables 首次请求会显式打开数据库，openConnection 会显式打开连接。closedDatabases 标记本会话关闭的库，菜单可重新打开。

refreshDatabases(id) 在保留连接、现有数据库缓存和打开状态的前提下重读库列表，按连接去重；仅取消并清理确实已删除的库。refreshTables(database,id?,force=false) 仅刷新目标库：保留旧表列表直至新列表返回，不重建连接；默认不加载从未打开的库，force 仅供手动刷新使用。其他连接与库缓存保留。

第四参数 schemaConnections 为需要 schema 层的连接 ID 只读列表，useWorkspace 按所属引擎 explorer 能力提供。loadTables 在同一数据库作用域下并行读取表/schema，共用请求去重、取消及失效检查，完成后原子更新 snapshots.schemas[database] 与 tables；空 schema 也保存。刷新/关闭同步失效 schema 缓存，不跨连接，MySQL 不增加 schema 请求。
