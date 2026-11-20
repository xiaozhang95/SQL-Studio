# PostgreSQL 数据编辑

[PostgreSQL](../README.md) · [源码](index.ts)

updateCellSQL(database,table,columns,result,row,columnIndex,value) 生成完整主键和原字段值条件的 UPDATE，使用 IS NOT DISTINCT FROM 处理 NULL，精确数字保留文本；不使用 MySQL LIMIT 或反引号。insertRowSQL 生成 INSERT/DEFAULT VALUES，验证必填与 NULL，identity/generated、二进制/数组/空间类型不支持手工写值。canInsertColumn 提供插入可用性。所有方法纯生成 SQL，异常抛 Error，实际提交沿用通用明确保存流程与目标数据库。

`deleteRowSQL(database, table, columns, result, row)` 有主键时使用完整主键定位，无主键时匹配原始整行。无主键删除在同一语句内最多选出一个匹配行，再按 `tableoid` 和 `ctid` 删除。标识符限定到目标 schema 和表，`NULL` 独立匹配，文本比较区分大小写和空格。
