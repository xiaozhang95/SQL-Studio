# PostgreSQL 数据库属性

metadataSQL(database) 生成按显式库名查询 pg_database 的只读 SQL；definition(result) 校验完整单行结果并返回 DatabaseDefinition（编码放 charset，另含所有者、ctype、连接数上限、注释）。不访问网络，缺失/截断/格式错误直接抛错。

sql(database,values,original) 只生成发生变化的所有者、连接数上限和注释修改。名称/所有者使用标识符转义，注释使用 E 字符串；上限为 -1（无限制）至 2147483647。名称、编码和排序规则不在此入口修改。无变化或非法输入抛错。

提交使用一个 DO 块，先核对原所有者/上限/注释，再执行修改，所有者最后转移；任一 SQL 失败整块回滚。并发变更提示重新加载，实际权限由数据库判断。此核对不是跨客户端的独占编辑锁。

[属性表单](components/form/README.md) 由 PostgreSQL 适配器提供给共享对象管理表单；异步请求、取消、状态和错误属于 useObjectManagement。
