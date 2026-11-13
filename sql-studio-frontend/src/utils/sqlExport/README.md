# SQL 文件导出

[源码](index.ts)

exportSQL(statement, title) 原样下载当前完整 SQL 为 UTF-8 .sql 文件，无返回值；清理文件名路径及非法字符，移除重复扩展名，下载接管后释放 Blob URL。

sqlFilename(title) 统一生成安全的 .sql 文件名，按 UTF-8 字节限制长度。

不解析 SQL、不发请求、不执行 SQL，适用于任何方言。MySQL 标识符、切分与历史标记清理归属 databases/mysql，不与文件下载混放。
