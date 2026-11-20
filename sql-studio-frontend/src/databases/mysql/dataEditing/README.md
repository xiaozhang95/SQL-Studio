# 表数据编辑

`updateRowSQL(database, table, columns, result, row, changes)` 生成单行 UPDATE。有主键时校验完整主键和被修改字段的原值，无主键时匹配原始整行，同一行的所有修改一起提交。标识符转义，新值使用 UTF-8 十六进制表达式以适配 SQL mode 引号规则。主键和精确数值保留原始文本。二进制、空间类型和生成列不能手工编辑。数据页使用显式写入请求提交，表数据预览使用只读请求。

insertRowSQL 生成显式列名 INSERT，未填写列省略以使用默认值/自增；必填字段校验，NULL 与空串区分，生成/特殊列禁止手填。canInsertColumn 判断新增可编辑字段。

`deleteRowSQL(database, table, columns, result, row)` 有主键时使用完整主键定位，无主键时复用整行匹配。整行匹配区分 NULL、精确数值和字符字节，所有列必须具有可准确比较的原值。更新和删除均使用 `LIMIT 1`，完全相同的记录每次只处理一条。MariaDB 共用该实现。
