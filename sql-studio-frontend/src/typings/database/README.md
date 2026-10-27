# 数据库 API 类型

[源码](index.ts)

Connection/ConnectionInput、DBTable、Column、QueryRequest、QueryResult 与服务端 API 契约一致。DatabaseType 引用 [数据库能力契约](../../databases/typings/README.md) 中的枚举推导类型，不重复定义。行数据为二维数组，密码只用于输入。

Connection.group 为可选分组名称，与连接配置一起保存；省略或空值兼容旧连接，统一归入“默认分组”。

导入使用 `@/typings/database`，不追加 /index 或扩展名；改契约时同步调用方及本说明。

QueryRequest.allowWrite?:boolean 默认不传（只读），对象管理确认保存显式传 true；limit?:number 用于受后端上限约束的元数据读取。普通查询编辑器不增加写入开关。

DBIndex 与服务端 Index 对齐，包含 name、unique、type 和 columns（name、position、可空 prefixLength、order）；TableDetails 组合 Column[] 和 DBIndex[]，仅用于对象树只读元数据。
