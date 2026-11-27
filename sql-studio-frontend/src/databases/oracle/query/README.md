# Oracle 查询与对象身份

`tableIdentity` 拆解 API 的双引号 Schema 和表名，保留标识内的点。对象树、表结构、DDL 和预览使用同一身份。`tableDataSQL` 默认使用 `FETCH FIRST 1000 ROWS ONLY`，数据页以「无排序预览」标明按库返回顺序展示。普通查询可关闭预览限制。`referencedTables` 为编辑器识别可见的已引用表名。
