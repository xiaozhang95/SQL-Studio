# MySQL 结果 SQL 列

[源码](index.ts) · [MySQL 入口](../README.md)

isSQLColumn(name:string):boolean 按列名识别明确承载 SQL 的结果列，供 DatabaseAdapter 和查询结果展示使用。忽略大小写、首尾空白，空格与下划线等价。

覆盖 DDL、SHOW CREATE 的库/表/视图/过程/函数/触发器/事件定义列、SHOW TRIGGERS 的 Statement、information_schema 的 VIEW_DEFINITION/ROUTINE_DEFINITION/ACTION_STATEMENT/EVENT_DEFINITION，以及 SQL/SQL_TEXT/Query/SQL Original Statement 语句记录列。不按普通数据值中的 SQL 关键字猜测；不识别任意自定义别名，不修改结果、请求数据库或执行语句。
