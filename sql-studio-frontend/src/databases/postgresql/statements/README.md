# PostgreSQL 脚本与历史

[PostgreSQL](../README.md) · [源码](index.ts)

splitPostgreSQLStatements(script:string):string[] 保留原 SQL 并按引号/注释外分号切分；识别标准字符串、E 反斜线字符串、双引号标识符、美元引号和嵌套块注释。普通字符串依赖后端强制 standard_conforming_strings=on；不支持跨请求 SET 改会话。空语句/纯注释忽略，未闭合脚本抛 Error，发送任何请求前完整解析。cleanPostgreSQLHistory 仅移除顶层独立历史来源行，保留美元函数体/字符串/注释内同名内容；不发请求。
