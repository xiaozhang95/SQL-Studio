# SSE 数据导出

streamTableData(id, database, table, onRows, signal) 读取专用只读 SSE 接口。逐帧校验 rows/done/error，UTF-8 跨块解码，await onRows 提供文件写入背压；只有收到 done 才成功，提前断流、错误事件和无效数据抛错。取消和回调失败会取消流读取。每帧至多约 64 MiB，不缓存整表。普通查询限制不变。
