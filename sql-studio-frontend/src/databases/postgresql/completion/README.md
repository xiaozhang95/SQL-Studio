# PostgreSQL 补全

[PostgreSQL](../README.md) · [源码](index.ts)

postgresqlCompletion(context:SQLCompletionContext) 返回 CodeMirror PostgreSQL 方言扩展，只消费当前 database 的元数据，按完整 schema/table 对构建 namespaces。默认 schema 为 public，当前表存在时使用其真实 schema/table；SQL 关键字大写。只生成扩展，不加载数据库、不修改查询范围。

SQLCompletionContext.namespace 为当前选择的 schema，未选择时 public；有明确当前表时仍按该完整表身份提供字段补全。只使用当前物理数据库的 schema map。
