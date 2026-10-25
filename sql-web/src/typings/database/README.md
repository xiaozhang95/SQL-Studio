# 数据库 API 类型

[源码](index.ts)

DatabaseType、Connection/ConnectionInput、DBTable、Column、QueryRequest、QueryResult 与服务端契约一致。行数据为二维数组，密码只用于输入。

Connection.group 为可选分组名称，与连接配置一起保存；省略或空值兼容旧连接，统一归入“默认分组”。

导入使用 `@/typings/database`，不追加 /index 或扩展名；改契约时同步调用方及本说明。
