# SQL 工具

[源码](index.ts)

identifier(name)：对 MySQL 库/表标识符使用反引号转义。只用于标识符，不用它拼接数据值或替代数据库权限。

exportSQL(statement, title)：本地下载 UTF-8 .sql 文件，原样保存完整 SQL；清理文件名中的路径和非法字符、避免重复扩展名，下载后释放 Blob URL。

导入使用 `@/utils/sql`，不追加 /index 或扩展名；改契约时同步调用方及本说明。
