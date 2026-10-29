# MariaDB 对象管理

mariadbObjects 实现 DatabaseObjectAdapter，复用已验证的 MySQL 库/表差异 DDL、标识符转义、数据编辑和结构导出；fields(columns,ddl?) 识别 MariaDB COLUMN_DEFAULT 的 SQL NULL、带引号字符串、数值和时间表达式。任意表达式及含反斜线的默认字面值保持锁定，防止未知 SQL mode 下重写特殊定义；生成列和复杂字段沿用保护，不通过可视化修改。

collationsSQL 从 COLLATION_CHARACTER_SET_APPLICABILITY 读取 FULL_COLLATION_NAME 与字符集映射，保留 utf8mb4_uca1400 等完整名称并标记服务器默认规则；defaultCollation 优先 utf8mb4，collations(result) 仍拒绝缺失字符集并过滤无字符集别名。参数、错误和返回结构遵循对象管理契约，无网络、取消或可变全局状态；所有读取与写入由所属 hook 显式发起。
