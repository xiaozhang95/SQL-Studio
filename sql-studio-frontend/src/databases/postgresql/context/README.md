# PostgreSQL 表引用上下文

referencedTables(sql,tables,schema='public') 返回 SQL 引用的完整表身份集合，用于 AI 上下文选择。扫描时忽略字符串、美元引号与嵌套注释，保留双引号标识符大小写/空格/点号；未限定名称按当前 schema（缺省 public）匹配，显式 schema 名称原样匹配。接受编辑器未完成草稿，不访问数据库；不作为权限或 SQL 执行解析器。
