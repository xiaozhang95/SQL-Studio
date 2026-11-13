# MySQL 脚本切分

[源码](index.ts)

splitSQLStatements(script) 按 MySQL 默认转义规则返回有效语句数组：仅在字符串、反引号和注释之外按分号切分，保留原 SQL 与终止分号。字符串支持反斜线转义；反引号标识符内的反斜线是普通字符。支持成对引号、以 LF 或 CRLF 结束的 `-- ` / `#` 行注释和块注释。

忽略空语句及纯普通注释，保留可执行版本注释；未闭合引号/块注释抛出中文错误，调用方在任何请求前完整校验。不处理 DELIMITER 指令；不发请求、不更改脚本。

在 sql-studio-frontend 执行 `pnpm test:sql`（原生 `node --test tests/mysql.test.mjs`）验证引号、注释、空语句及批量行为。

useDatabaseSQL(statement) 返回完整 USE 语句中的库名，否则为 undefined；支持普通注释和反引号转义，不解释可执行版本注释。只做范围识别，成功与权限由实际请求确认。

`splitSQLStatements` 的可选 executableComments 默认包含 `!`，MariaDB 显式添加 `M!`。GreptimeDB 使用 `{ ansi: true }` 处理 `--` 行注释和成对引号，保留反斜线原义。`useDatabaseSQL` 在 ANSI 模式下同时识别双引号库名和成对双引号转义。
