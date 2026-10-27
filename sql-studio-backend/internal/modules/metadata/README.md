# 数据库对象模块

`New(repository Connections, database Database) *Service` 注入按 ID 获取连接的接口与元数据读取接口，不依赖连接管理模块。

- `Databases(ctx, id) ([]string, error)`：获取指定连接的数据库。
- `Tables(ctx, id, database) ([]model.Table, error)`：获取指定库的表与视图。
- `Columns(ctx, id, database, table) ([]model.Column, error)`：读取字段结构。
- `DDL(ctx, id, database, table) (string, error)`：读取对象 DDL。

所有方法的 `ctx` 为 `context.Context`，其余参数为 `string`；每次按显式连接 ID 读取凭据，最长 10 秒，继承调用者取消；错误原样传递。对象范围通过 `model.TableRef` 交给引擎，不拼协议 SQL，不缓存可变连接范围。

app 注入实现，HTTP 层仅调用模块公开入口。测试使用两个连接的同名对象验证范围、凭据、超时和取消，不访问真实数据库。
