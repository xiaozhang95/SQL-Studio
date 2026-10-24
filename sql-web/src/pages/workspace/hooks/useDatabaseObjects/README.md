# 连接与库表元数据缓存

[源码](index.ts)

## 调用与返回

`(connectionId: string, database: string, onDatabasesLoaded: (id: string, databases: string[]) => void)`；参数只确定当前查询消费的范围，不自动发起连接。

返回 snapshots（按连接 ID 的 loading/connected/error、库列表、表缓存和错误）、openConnection、closeConnection、refreshConnection、loadTables(database, connectionId?)，以及当前范围的 connected、databases、tables、currentTables、loading、tablesLoading、error、tableError。

## 生命周期与边界

各连接独立维护请求控制器、库表缓存和并发去重；展开连接显式加载库列表，成功后标记 connected，即使列表为空也表示连接通过。加载失败保留原因，可重新打开重试。切换查询范围不清除其他已打开连接的缓存，也不自动连接保存的草稿。

loadTables 仅访问已打开连接；按连接/库缓存和去重，树箭头或双击连接/库节点时触发，选择文本本身不请求列表。关闭/刷新连接会取消并废弃该连接的所有旧代请求，迟到响应不能重新点亮节点或回填缓存；卸载取消全部请求。关闭不删除本机保存的连接，也不发送数据库写入。

onDatabasesLoaded 仅在当前请求代有效且库列表成功返回时触发，用于工作区校验草稿范围；调用方提供稳定回调。关闭由工作区清空相关查询范围，缓存 hook 只管理元数据和请求。
