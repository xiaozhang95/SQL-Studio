# 后端包索引

- [应用装配](app/README.md)
- [运行配置](config/README.md)
- [本地连接仓库](connection/README.md)
- [Gin HTTP 接口](httpapi/README.md)
- [跨层业务契约](model/README.md)
- [MySQL 协议驱动](mysql/README.md)
- [PostgreSQL 协议驱动](postgres/README.md)
- [业务策略与接口](service/README.md)

app 负责装配，httpapi → service → model；基础设施只依赖 model。每个实际包有 README 和包注释，不按前端组件方式机械创建 Go 子目录。
