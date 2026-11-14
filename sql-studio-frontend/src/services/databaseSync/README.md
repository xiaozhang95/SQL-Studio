# 数据库同步服务

checkDatabaseSync(input,signal) 读取只读检查结果。runDatabaseSync(input,signal,onProgress) 读取 UTF-8 NDJSON，校验检查摘要，并逐条回调当前阶段、表和已确认写入数。只有收到覆盖全部对象的进度和 done 才完成。服务端错误和网络中断抛出异常，取消会关闭当前请求。listSyncDatabases(input,signal) 按连接 ID 或临时凭据读取用户库。检查与执行支持混用两种连接。临时凭据仅放在 POST 请求体。
