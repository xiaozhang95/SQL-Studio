# 数据库对象模块

`New(repository Connections, database Database) *Service` 注入按 ID 获取连接的接口与元数据读取接口，不依赖连接管理模块。

- `Databases(ctx, id) ([]string, error)`：获取指定连接的数据库。
- `Tables(ctx, id, database) ([]model.Table, error)`：获取指定库的表与视图。
- `Columns(ctx, id, database, table) ([]model.Column, error)`：读取字段结构。
- `DDL(ctx, id, database, table) (string, error)`：读取对象 DDL。

所有方法的 `ctx` 为 `context.Context`，其余参数为 `string`；每次按显式连接 ID 读取凭据，最长 10 秒，继承调用者取消；错误原样传递。对象范围通过 `model.TableRef` 交给引擎，不拼协议 SQL，不缓存可变连接范围。

app 注入实现，HTTP 层仅调用模块公开入口。测试使用两个连接的同名对象验证范围、凭据、超时和取消，不访问真实数据库。

`Indexes(ctx, id, database, table) ([]model.Index, error)` 按显式范围读取索引与按顺序排列的字段，包含主键、唯一性、类型、前缀长度和排序方向；无索引返回空数组。`ForeignKeys(ctx, id, database, table)` 返回有序列映射和引用规则，无外键或引擎不支持返回空数组。两者与其他元数据方法使用相同的 10 秒超时和取消。

Schemas(ctx,id,database) 复用显式目标、凭据消费接口与 10 秒超时，返回可访问的 schema 名称列表；业务层不拼元数据 SQL。

StreamTableData(ctx,id,database,table,emit) 使用可选导出消费接口，独立于普通查询限制，必须显式指定库表；同一个 Service 最多2条导出流，每条最多30分钟，回调背压、取消和错误透传，无结果缓存，不执行用户 SQL。

Monitor(ctx,id,database) 使用已保存连接并按引擎读取只读统计，沿用 10 秒超时，响应加上 UTC 采样时间。MySQL 和 MariaDB 使用实例状态，PostgreSQL 和 GreptimeDB 支持数据库范围。
