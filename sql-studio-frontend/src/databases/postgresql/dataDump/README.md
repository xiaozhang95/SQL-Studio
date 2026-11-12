# PostgreSQL 结构和数据转储

dataDump 提供 querySQL(database,table)、metadataSQL(database,table)、dump(database,table,ddl,result,columns,metadata)。前两者生成目标表查询与自有 SERIAL/IDENTITY 序列元数据 SQL；不发起请求。dump 返回可在目标数据库逐条执行的单表 SQL，使用完整 schema/table 身份，不添加 DROP 或跨库 USE。

创建缺失 schema、自有 SERIAL 序列及表/约束/索引，恢复数据，再恢复序列位置。IDENTITY 使用 OVERRIDING SYSTEM VALUE，生成列由数据库重算。INT8/NUMERIC 保留文本精度，BYTEA用decode，NULL/空串、布尔、JSON/数组等可输入文本由目标列类型解析。文本用E字符串转义，不把内容拼成命令。

数据批次截断、列不一致、无序列权限、外部或共享序列、非法值均使转储失败。序列缓存可能使源last_value大于已使用值，恢复保留该位置。空序列恢复start且is_called=false。

仅普通表可导出数据；视图仅结构，分区父表的数据转储拒绝，分区子表/外部表由后端DDL拒绝。外部类型、函数、扩展、外键目标等依赖需预先存在，不导出授权、角色或整个库。多次读取不提供并发写入下的一致备份；导出期间应避免写入，完整备份仍使用pg_dump。请求、取消、错误和文件提交由 useDataExport 管理。

prepareDump 返回流式 DumpPlan，dumpRows 对每个 QueryResult 分批生成 INSERT；SQL 引号/括号扫描仅拆 CREATE TABLE 顶层外键，延后到全部表及数据完成后添加，保留字符串和表达式内逗号/换行。原 dump 入口复用同一生成逻辑，保留序列校验和生成列过滤。仅结构也创建 SERIAL/IDENTITY 依赖；复杂依赖仍按既有边界明确限制。
