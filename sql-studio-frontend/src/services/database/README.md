# 数据库 API 服务

[源码](index.ts)

统一封装连接列表/保存/删除/测试、库表/字段/DDL 与 SQL 请求。请求走 /api，元数据和查询接受 AbortSignal。具体路径与结果见根目录 docs/API.md。

getConnectionGroups(signal?) 返回含默认和空分组的 string[]；createConnectionGroup(name) 返回最新列表；renameConnectionGroup(name,newName) 返回 groups 和脱敏 connections；moveConnectionGroup(id,group) PATCH 指定连接归属并返回脱敏连接。这些操作仅保存本地元数据，不请求数据库。

导入使用 `@/services/database`，不追加 /index 或扩展名；改契约时同步调用方及本说明。

executeObjectSQL(id, database, sql, signal?) 仅供对象管理确认提交，使用已有 query API 显式 allowWrite:true；普通 executeQuery 不设置该值时保持只读。QueryRequest 也允许元数据请求设置 limit（服务端仍限制最高 5000）。

executeObjectSQL 也供表数据单元格点击保存使用，传递显式连接、库和限定目标的单行更新；普通 executeQuery 默认只读。

getIndexes(id, database, table, signal?) 返回 Promise<DBIndex[]>；显式携带原始连接、库、表范围，支持取消。无索引返回空数组，失败由调用方展示和重试，不以 DDL 文本推测索引。

setConnectionSession(id, open, database?, signal?) 返回 Promise<{open:boolean}>；省略库为整个连接，指定库仅控制该库。等待后端释放驱动连接后关闭才成功，失败保留前端窗口；打开验证真实连通性。

getSchemas(id,database,signal?) 调用 /connections/{id}/schemas，返回可访问的 schema 字符串数组，包含无表 schema；复用显式连接/库和取消。

deleteConnectionGroup(name) DELETE /connection-groups，返回 groups 与脱敏 connections；删除组内连接移入默认分组，不删除连接。
