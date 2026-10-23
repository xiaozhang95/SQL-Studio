# 库表元数据缓存

[源码](index.ts)

## 调用与返回

`(connectionId: string, database: string, refresh: number)`

返回 databases、tables、currentTables、loadTables、loading、tablesLoading、error、tableError。

## 生命周期与边界

缓存与并发去重按连接/刷新代次隔离；旧请求取消后不写新快照。loadTables 按库去重；切换库加载该库表。Schema 身份保留在 DBTable 中。

请求错误、取消和持久化失败沿用实现中的边界，组件不重复维护同一份业务状态。
