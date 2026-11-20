# MySQL 库表查询

[源码](index.ts)

identifier(name) 为库/表名添加反引号，并将内部反引号成对转义。只用于标识符，不用于拼接数据值。

`tableDataSQL(database, table, { preview = true } = {})` 生成转义库表名的 SELECT。打开和刷新表数据使用默认的 `LIMIT 1000`。表菜单「新建查询」传 `preview: false`，生成普通 SELECT 草稿。

tableLabel 原样返回 MySQL 表名，tableListResult 保留表名/类型/注释三列；不增加 PostgreSQL schema 层。
