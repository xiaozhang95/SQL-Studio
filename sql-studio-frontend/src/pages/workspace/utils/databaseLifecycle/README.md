# 单库请求代

`new DatabaseLifecycle(connection: AbortSignal)` 为一个连接建立库级取消范围。`scope(database)` 返回 signal 和 valid()，同时继承连接和库级取消；`close(database)` 取消并废弃该库请求代，其他库不受影响。再次 scope 创建新代，旧响应仍然失效。仅处理请求信号，由 useDatabaseObjects 等待服务端实际关闭并释放缓存。
