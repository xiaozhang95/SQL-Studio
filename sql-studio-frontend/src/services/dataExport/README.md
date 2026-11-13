# SSE 数据导出

Accept-Language 由共享 fetchResponse 添加，与普通 JSON API 一致。后端 error 事件携带本次请求语言的应用错误，原始数据库原因保留；前端协议校验错误在导出 hook 的展示边界翻译。

streamTableData(id, database, table, onRows, signal) 读取专用只读 SSE 接口。通过全局 request 工具处理连接、HTTP 和无效响应错误。逐帧校验 rows/done/error，UTF-8 跨块解码，await onRows 提供文件写入背压，收到 done 才成功。提前断流、错误事件和无效数据抛错，取消和回调失败会取消流读取。每帧至多约 64 MiB。
