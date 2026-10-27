# MySQL 对象管理

[源码](index.ts) · [MySQL 入口](../README.md)

导出 mysqlObjects，满足 DatabaseObjectAdapter。支持创建/修改库默认字符集排序规则、删库、建表、设计表、删表/视图、TRUNCATE、RENAME 与结构转储。所有标识符统一转义，字符集/排序规则限定单词字符，字段类型使用完整语法白名单；默认表达式只接受 CURRENT_TIMESTAMP（可含精度），常量和注释按读取到的 SQL mode 转义。

fields(columns, ddl?) 从元数据构造设计草稿；复杂类型、生成列、已有二进制默认值及其他特殊属性锁定，避免不完整地重建定义。字段声明中的独立字符集/排序规则会在修改时保留。未修改字段不出现在 ALTER 中；保留其他索引，支持主键差异。新建字段追加到末尾，界面不提供字段排序、任意表达式或二级索引编辑。修改外键关联字段时由数据库权限/约束检查拒绝，不关闭外键检查。

默认字段为可空 VARCHAR(255)，新建表界面另提供 BIGINT 自增主键初始行。每次保存只生成一条 DDL，不执行 SQL、不存凭据。dump 返回带 USE 的结构 SQL，不含 DROP/数据行；调用者仅下载，不自动运行。

pnpm test:objects 使用隔离输入验证标识符、默认值、SQL mode、注入边界、特殊字段保护和差异 ALTER，不访问 MySQL。

sameDefinition(current, original) 用于表设计提交前的结构检查：只忽略 SHOW CREATE TABLE 末行表选项中的 AUTO_INCREMENT 计数，字段、注释、索引等变化仍判为不同。

defaultCollation 优先 utf8mb4 默认排序规则，initialFields 返回 BIGINT 自增主键 id，dumpWithData 统一包含结构/精确数据及 NO_AUTO_VALUE_ON_ZERO 的保存恢复包装；外层不拼 MySQL 会话 SQL。
