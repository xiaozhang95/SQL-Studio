# PostgreSQL 查询与标识符

[PostgreSQL](../README.md) · [源码](index.ts)

identifier(value) 转义双引号；tableIdentity(table) 解析元数据返回的完整双引号 schema/table 对，普通单名回退 public，不能将点号拆分为层级。relation/tableDataSQL 生成显式 schema 表预览（最多 1000 行），database 是独立连接目标，不能写跨数据库限定表。literal 将 NULL 或文本转义成 E 字符串，拒绝空字符和非标量。exportDDL 输出目标数据库注释及结构参考，不插入 USE，不承诺为完整备份。均为纯函数，解析失败抛 Error。

explorerTableIdentity(table) 返回 {schema,name}，用于分层展示；完整双引号表身份继续用于所有 API/SQL 操作，不使用显示名称推断对象范围。

tableListResult 返回 Schema/表名/类型/注释四列，可按 schema 筛选；tableLabel 对常规标识符展示 schema.table，特殊名称保留必要引号。显示转换不改写 API/缓存表身份。

schemaListResult 将服务端返回的完整 schema 名称列表转换为结构结果，包含没有表的 schema。
