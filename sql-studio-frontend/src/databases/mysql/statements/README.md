# MySQL 脚本切分

[源码](index.ts)

splitSQLStatements(script) 按 MySQL 默认转义规则返回有效语句数组：仅在字符串、反引号和注释之外按分号切分，保留原 SQL 与终止分号。支持反斜线转义、成对引号、`-- ` / `#` 行注释和块注释。

忽略空语句及纯普通注释，保留可执行版本注释；未闭合引号/块注释抛出中文错误，调用方在任何请求前完整校验。不处理 DELIMITER 指令；不发请求、不更改脚本。

在 sql-studio-frontend 执行 `pnpm test:sql`（原生 `node --test tests/mysql.test.mjs`）验证引号、注释、空语句及批量行为。
