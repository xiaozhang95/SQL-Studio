# 数据库 API 服务

[源码](index.ts)

统一封装连接列表/保存/删除/测试、库表/字段/DDL 与 SQL 请求。请求走 /api，元数据和查询接受 AbortSignal。具体路径与结果见根目录 docs/API.md。

导入使用 `@/services/database`，不追加 /index 或扩展名；改契约时同步调用方及本说明。

executeObjectSQL(id, database, sql, signal?) 仅供对象管理确认提交，使用已有 query API 显式 allowWrite:true；普通 executeQuery 不设置该值时保持只读。QueryRequest 也允许元数据请求设置 limit（服务端仍限制最高 5000）。

executeObjectSQL 也供表数据单元格点击保存使用，传递显式连接、库和限定目标的单行更新；普通 executeQuery 默认只读。
