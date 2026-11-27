# MySQL 脚本切分

[源码](index.ts)

splitSQLStatements(script) 按 MySQL 默认转义规则返回有效语句数组：仅在字符串、反引号和注释之外按分号切分，保留终止分号。字符串支持反斜线转义；反引号标识符内的反斜线是普通字符。支持成对引号、以 LF 或 CRLF 结束的 `-- ` / `#` 行注释和块注释。行首（可有空格或 Tab）的 `--CREATE` 等无空白注释按编辑器注释处理，返回待执行片段时补成 `-- CREATE` 以符合 MySQL/MariaDB 语法；纯注释不提交。行中 `1--2` 运算、字符串和标识符保持原义，编辑器草稿不被改写。

同一脚本中，独立的会话级 `SET sql_mode = '…'` 单引号字面量赋值决定后续字符串是否按 `NO_BACKSLASH_ESCAPES` 处理，支持 `SESSION`、`LOCAL`、`@@SESSION.`、`@@LOCAL.` 和 `@@`。后续字面量赋值可恢复反斜线转义。每次调用从默认规则开始。动态表达式、变量赋值、多项赋值和版本注释照常发送，由数据库解释，切分器沿用最近可确定的状态。

忽略空语句及纯普通注释，保留可执行版本注释。识别无待执行 SQL 时独占一行的 `DELIMITER`，用新分隔符切分存储程序脚本。指令和自定义分隔符从待发送片段中移除，`DELIMITER ;` 恢复默认分号。无效分隔符或未闭合引号/块注释在发送请求前报错。ANSI 模式沿用分号。

在 sql-studio-frontend 执行 `pnpm test:sql`（原生 `node --test tests/mysql.test.mjs`）验证引号、注释、空语句及批量行为。

useDatabaseSQL(statement) 返回完整 USE 语句中的库名，否则为 undefined；支持普通注释和反引号转义，不解释可执行版本注释。只做范围识别，成功与权限由实际请求确认。

`splitSQLStatements` 的可选 executableComments 默认包含 `!`，MariaDB 显式添加 `M!`。GreptimeDB 使用 `{ ansi: true }` 处理 `--` 行注释和成对引号，保留反斜线原义。`useDatabaseSQL` 在 ANSI 模式下同时识别双引号库名和成对双引号转义。
