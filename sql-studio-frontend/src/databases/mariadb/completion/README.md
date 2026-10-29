# MariaDB 补全

mariadbCompletion(context:SQLCompletionContext) 返回 CodeMirror sql 扩展，使用 MariaSQL 方言及当前库/表元数据；关键字大写。库或表为空时不预选默认范围。不请求网络、不修改 SQL 或连接。
