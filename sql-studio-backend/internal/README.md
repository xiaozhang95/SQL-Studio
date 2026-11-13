# 后端包索引

- [应用装配](app/README.md)
- [运行配置](config/README.md)
- [本地连接仓库](connection/README.md)
- [Gin HTTP 接口](httpapi/README.md)
- [前端静态资源](webui/README.md)：从磁盘目录读取网页，Electron 指定随包资源目录。
- [应用消息语言](localization/README.md)：请求语言选择与系统消息翻译，只由 HTTP 层使用。
- [跨层业务契约](model/README.md)
- [MariaDB 引擎](mariadb/README.md)：独立类型、组合 MySQL 线协议及生命周期。
- [MySQL 协议驱动](mysql/README.md)
- [独立业务模块](modules/README.md)：连接管理、对象结构、SQL 查询。

app 负责装配，httpapi → modules 的公开入口 → model；基础设施实现模块消费的接口，只依赖 model。模块之间不直接导入，单进程运行、单一启动入口。每个实际包有 README 和包注释，功能使用独立包，保留 Go 原生职责文件组织。

- [用户配置文件仓库](statefile/README.md)：配置目录下的分区 JSON，默认位于用户主目录。

- [DeepSeek 客户端](deepseek/README.md)：官方模型 API 传输。

- [数据库分派](database/README.md)：只按连接类型分派，不导入具体驱动。
- [PostgreSQL 协议驱动](postgresql/README.md)：PolarDB PostgreSQL 连接、schema 元数据与执行。

- [rowstream](rowstream/README.md)：引擎共用的有界导出游标扫描，仅依赖 model/database/sql。

工作区分片保存由 [workspace模块](modules/workspace/README.md) 编排，基础设施见 [statefile](statefile/README.md)，与数据库引擎和查询执行隔离。

- [Agent业务](modules/agent/README.md)、[Agent布局](modules/agentlayout/README.md)、[Agent契约](model/agent/README.md)。
- [Agent记录](agentstate/README.md)、[思考流传输](deepseek/agent/README.md)。
