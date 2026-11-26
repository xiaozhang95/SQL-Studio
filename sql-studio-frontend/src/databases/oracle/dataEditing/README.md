# Oracle 数据编辑

`canInsertColumn`、`insertRowSQL`、`updateRowSQL` 和 `deleteRowSQL` 供共享网格调用。主键优先，变更字段同时匹配原值。无主键时使用完整原行匹配并通过 ROWID 限定单行。由数据库生成的列以及不能精确比较的复杂类型使用 SQL 编辑器处理。`sqlValue` 生成保留 NUMBER 精度、DATE 时间和二进制的字面量。
