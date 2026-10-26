# MySQL

[源码](index.ts) · [配置](profile/README.md) · [查询语句](query/README.md) · [脚本切分](statements/README.md) · [历史 SQL 清理](history/README.md) · [编辑器补全](completion/README.md)

入口按 DatabaseAdapter 契约组装当前 MySQL 实现。profile 为产品元数据，splitStatements 返回有效语句数组，cleanHistory 去除编辑器来源标记，tableDataSQL 生成限定库表的预览 SQL，completion 返回 CodeMirror 扩展。

专属逻辑在对应子模块实现，入口只负责组合；外部通过 databases/getDatabaseAdapter 调用。通用连接表单、结果表格、HTTP 传输及连接分组不归属 MySQL，不在此复制。当前仅支持 MySQL；普通查询默认只读，对象管理确认后显式写入，并按读取的 SQL mode 转义。

- [对象管理](objectManagement/README.md)：MySQL 库表元数据、差异 DDL 和结构转储。

- [数据编辑](dataEditing/README.md)：按主键与单元格原值生成安全单行 UPDATE。

- [数据转储](dataDump/README.md)：生成精确值 INSERT。
