# SQL 工具

[源码](index.ts)

identifier(name)：对 MySQL 库/表标识符使用反引号转义。只用于标识符，不用它拼接数据值或替代数据库权限。

exportSQL(statement, title)：本地下载 UTF-8 .sql 文件，原样保存完整 SQL；清理文件名中的路径和非法字符、避免重复扩展名，下载后释放 Blob URL。

导入使用 `@/utils/sql`，不追加 /index 或扩展名；改契约时同步调用方及本说明。

splitSQLStatements(script)：按 MySQL 默认转义规则切分脚本，仅识别引号、反引号及注释外的分号，保留原 SQL 与终止分号。支持反斜线、成对引号、`-- ` / `#` 行注释与块注释；忽略空语句、纯普通注释，保留可执行版本注释。未闭合引号/块注释在请求前报错。不处理 mysql 客户端 DELIMITER 指令或自定义分隔符。

stripHistoryMarkers(script)：仅移除引号与块注释外、独占一行的 `-- 历史记录` 来源标记，兼容 CRLF、缩进和重复标记；保留字符串/标识符内容及其他注释。用于历史保存与载入，不修改实际执行请求或编辑器原稿。

回归检查从仓库根运行 `node --test scripts/test-sql-statements.mjs`（Node 24），覆盖批量、字符串/标识符分号、注释、空脚本、未闭合内容和历史标记反复载入保存。
