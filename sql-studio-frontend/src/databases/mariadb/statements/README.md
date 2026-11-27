# MariaDB 脚本

splitMariaDBStatements(script:string):string[] 复用 [MySQL 切分规则](../../mysql/statements/README.md)，在同一脚本内跟踪会话级字面量 `SET sql_mode` 对反斜线转义的影响。独立的 `/*! ... */` 与 `/*M! ... */` 作为语句保留，交由服务器判断版本条件。未闭合引号或注释会抛错。useMariaDBDatabase(statement) 仅识别完整普通 USE 并返回库名。两者均为本地计算。
