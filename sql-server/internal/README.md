# 后端包索引

- [应用装配](app/README.md)
- [运行配置](config/README.md)
- [本地连接仓库](connection/README.md)
- [Gin HTTP 接口](httpapi/README.md)
- [跨层业务契约](model/README.md)
- [MySQL 协议驱动](mysql/README.md)
- [独立业务模块](modules/README.md)：连接管理、对象结构、SQL 查询。

app 负责装配，httpapi → modules 的公开入口 → model；基础设施实现模块消费的接口，只依赖 model。模块之间不直接导入，单进程运行、单一启动入口。每个实际包有 README 和包注释，功能使用独立包，保留 Go 原生职责文件组织。
