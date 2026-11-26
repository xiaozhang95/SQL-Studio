# Oracle 脚本

`oracleTokens` 区分普通词法单元、引用标识符、字符串和符号，跳过注释。支持 Oracle q/nq 引号及双写引号。`splitOracleStatements` 按分号切分 SQL，按独立一行的斜杠结束 PL/SQL 块及程序定义。作为脚本最后一条时可省略斜杠。`cleanOracleHistory` 补齐载入编辑器所需的分隔符。
