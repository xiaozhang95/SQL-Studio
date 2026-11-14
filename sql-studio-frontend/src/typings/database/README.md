# 数据库 API 类型

[源码](index.ts)

Connection/ConnectionInput、DBTable、Column、QueryRequest、QueryResult 与服务端 API 契约一致。DatabaseType 引用 [数据库能力契约](../../databases/typings/README.md) 中的枚举推导类型，不重复定义。行数据为二维数组，密码只用于输入。

Connection.group 为可选分组名称，与连接配置一起保存；界面收到空分组值时按“默认分组”展示。

导入使用 `@/typings/database`，不追加 /index 或扩展名；改契约时同步调用方及本说明。

QueryRequest.allowWrite?:boolean 默认不传（只读），对象管理确认保存显式传 true；limit?:number 用于受后端上限约束的元数据读取。SQL 窗口手动执行和结果刷新直接传 true，不增加写入开关或额外确认。

DBIndex 与服务端 Index 对齐，包含 name、unique、type 和 columns（name、position、可空 prefixLength、order）；TableDetails 组合 Column[] 和 DBIndex[]，仅用于对象树只读元数据。

Connection.database? 对应后端维护数据库字段，仅 PostgreSQL 使用，空值默认 postgres；不是查询页的当前数据库。PostgreSQL DBTable.name 为完整双引号 schema/table 对，所有元数据和查询目标原样传递，不拆分点号。

DBTable.viewDependencies? 提供 PostgreSQL 视图的直接视图依赖，使用同样的完整身份。DBTable.extension? 记录 PostgreSQL 扩展成员所属扩展。Column.charset? 和 Column.collation? 是 MySQL 协议字符字段的可选元数据，供占位视图保留字符集与排序规则。

DBIndex.primary? 为可选主键标志，用于 PostgreSQL 真实索引名，旧 MySQL PRIMARY 名称仍兼容。DBForeignKey 保存约束名、引用库或 Schema 和表、更新与删除规则，以及按约束顺序排列的本地列与引用列。TableDetails.foreignKeys 在引擎支持时提供。

QueryRequest.schema? 为 PostgreSQL 当前 schema，后端在本次请求独占的连接上验证 USAGE 并设置 search_path 后再执行。省略不改变旧行为；MySQL 拒绝非空独立 schema。

QueryRequest.matchRows? 表示 MySQL/MariaDB 请求匹配行计数，仅单元格 UPDATE 使用；默认 false，不改变 allowWrite 与单语句限制。
