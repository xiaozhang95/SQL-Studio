# PostgreSQL 脚本与历史

[PostgreSQL](../README.md) · [源码](index.ts)

splitPostgreSQLStatements(script:string):string[] 保留原 SQL 并按引号和注释外的分号切分。识别普通字符串、E 字符串、双引号标识符、美元引号和嵌套块注释。每批会话以 `standard_conforming_strings=on` 开始。只在当前脚本内根据字面量 `SET [SESSION | LOCAL] standard_conforming_strings`、`DEFAULT`、`RESET` 更新普通字符串的转义方式，并按事务提交、回滚及保存点处理作用域。动态设置由服务器解释，切分器沿用最近可确定的状态。发送请求前完成解析，跳过空语句和纯注释，未闭合脚本抛 Error。

cleanPostgreSQLHistory 使用相同的扫描方式移除顶层独立历史来源行，保留美元函数体、字符串和注释中的同名内容。
