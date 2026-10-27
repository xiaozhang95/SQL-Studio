# MySQL 库表查询

[源码](index.ts)

identifier(name) 为库/表名添加反引号，并将内部反引号成对转义。只用于标识符，不用于拼接数据值。

tableDataSQL(database, table) 返回 `SELECT * FROM 库.表 LIMIT 1000;`，两个标识符均转义；供表菜单新建查询及数据预览使用。不发起请求、不修改业务数据；实际只读和返回限制仍由后端控制。

tableLabel 原样返回 MySQL 表名，tableListResult 保留表名/类型/注释三列；不增加 PostgreSQL schema 层。
