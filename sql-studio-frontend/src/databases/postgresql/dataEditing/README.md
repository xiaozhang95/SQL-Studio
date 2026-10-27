# PostgreSQL 数据编辑

[PostgreSQL](../README.md) · [源码](index.ts)

updateCellSQL(database,table,columns,result,row,columnIndex,value) 生成完整主键和原字段值条件的 UPDATE，使用 IS NOT DISTINCT FROM 处理 NULL，精确数字保留文本；不使用 MySQL LIMIT 或反引号。insertRowSQL 生成 INSERT/DEFAULT VALUES，验证必填与 NULL，identity/generated、二进制/数组/空间类型不支持手工写值。canInsertColumn 提供插入可用性。所有方法纯生成 SQL，异常抛 Error，实际提交沿用通用明确保存流程与目标数据库。
