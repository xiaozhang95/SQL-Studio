# PostgreSQL 数据编辑

[PostgreSQL](../README.md) · [源码](index.ts)

`updateRowSQL(database, table, columns, result, row, changes)` 生成单行 UPDATE。有主键时校验完整主键和被修改字段的原值，无主键时匹配原始整行，在单条语句内锁定最多一行并提交该行的所有修改。`insertRowSQL` 生成 INSERT 或 DEFAULT VALUES，验证必填和 NULL。`canInsertColumn` 判断新增字段是否可手工填写。identity、生成列、二进制、数组及空间类型不能手工写值。SQL 生成错误以 Error 返回，写入由数据页显式提交。

`deleteRowSQL(database, table, columns, result, row)` 有主键时使用完整主键定位。无主键表的更新和删除使用相同的整行条件，在执行语句内选出最多一条匹配行，再按 `tableoid` 和 `ctid` 定位。标识符限定到目标 schema 和表，`NULL` 独立匹配，文本比较区分大小写和空格。
