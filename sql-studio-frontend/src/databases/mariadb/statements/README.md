# MariaDB 脚本

splitMariaDBStatements(script:string):string[] 按 MySQL 协议字符串、反引号及注释规则切分；独立 /*! ... */ 与 /*M! ... */ 均保留。未闭合引号/注释抛错。useMariaDBDatabase(statement) 仅识别完整普通 USE 并返回库名，不推断可执行注释中的切库。没有网络请求或可变状态。
