# 后端架构

整体框架见 [项目框架](ARCHITECTURE.md)，维护规则见 [后端规范](BACKEND_STANDARDS.md)。

## 包与依赖

| 包                    | 职责与依赖                                                         |
| --------------------- | ------------------------------------------------------------------ |
| main.go（后端根目录） | 加载 config、创建 app、处理退出信号                                |
| app                   | 创建存储、MySQL/PostgreSQL、AI 客户端，注入业务模块并装配 HTTP     |
| httpapi               | Gin 路由、单 JSON 解码、本机同源保护和错误映射；仅调用模块公开入口 |
| modules/connections   | 连接校验、分组、保存与 7 秒测试                                    |
| modules/metadata      | 显式连接与对象范围，10 秒超时                                      |
| modules/query         | 行数、30 秒超时、全进程 4 并发                                     |
| modules/settings      | 分区校验、32 MiB 对象限制和 AI 配置脱敏                            |
| modules/ai            | 上下文校验、续写/优化/模型发现，共享 4 并发                        |
| model                 | 跨层命名结构、错误与只读定义                                       |
| mysql                 | MySQL 驱动、TLS、SQL 识别、元数据和结果编码                        |
| postgresql            | PostgreSQL 驱动、schema 元数据和结果编码                           |
| database              | 只按连接类型分派，具体实现由 app 注入                              |
| connection            | AES-GCM 密码与原子落盘                                             |
| statefile             | 版本、修订、同进程互斥与分区 JSON 原子替换                         |
| deepseek              | 官方 HTTPS 模型调用，不执行 SQL                                    |
| config                | 环境变量和目录解析                                                 |
| webui                 | 构建版内嵌前端/开发版磁盘资源、Gin 静态路由；不依赖业务模块           |

modules 各自只依赖 model 与最小消费接口，不导入兄弟模块、驱动、Gin 或存储实现。app 创建一次 query/ai 服务，全请求共享其预算。架构测试递归约束依赖与 README/doc.go。

## 请求和资源生命周期

HTTP context 传入模块和驱动，保留取消、超时、游标与连接释放。API 省略 allowWrite 时默认只读，SQL 窗口显式允许写入；请求保持单语句、1000 行（最多 5000）、约 8 MiB 内容；精确整数和 DECIMAL 保留文本。输入与状态码见 [接口列表](API.md)。

普通 JSON 请求限制 1 MiB，配置写入信封限制 32 MiB + 1024 字节。配置文件缺失可重建，现存文件严格 CAS，损坏或未知版本拒绝覆盖。密码不进入响应与日志；AI Key 仅保存在后端配置，响应脱敏。

Go 服务默认仅监听 127.0.0.1:8080，提供构建网页及 API。退出给予在途请求 5 秒结束时间。目录、启动、环境变量和测试入口见 [后端 README](../sql-studio-backend/README.md)。

仓库根目录 `build.ps1` 先构建 Vite dist，再同步到 internal/webui 的生成目录并用 embedded 标签编译。app 调用 webui.Register，以 Gin StaticFS/StaticFileFS 注册前端路由，API 命名空间优先；内嵌版不依赖运行目录的前端文件，显式 SQLDESK_WEB_DIR 可覆盖。开发构建使用磁盘 dist，不需要占位资源。

rowstream 是引擎共用的导出游标扫描基础设施，只依赖 model 和 database/sql，不执行 SQL 或访问HTTP/存储；mysql/postgresql 的导出方法负责方言及只读事务，metadata 负责凭据/并发/期限，httpapi 仅编码 SSE。

modules/workspace 只依赖model和仓库消费接口；statefile实现分片、旧工作区后端迁移、CAS索引提交及旧内容回收。布局/范围是轻量索引，草稿与结果按SHA256独立保存，GET索引不解析返回所有结果，PUT响应也不回传结果。原子性边界为最后的索引替换，崩溃可能留下孤立内容但不会让索引指向尚未写完的内容；旧 workspace.json 原样保留。

MariaDB 由 internal/mariadb 组合共享 MySQL 线协议，app 以独立 mariadb 类型注册。只有 mariadb 可以依赖 mysql 的协议客户端；业务模块继续只消费 model 与自身接口，不直接导入具体引擎。MariaDB 拥有独立生命周期状态。

## 数据库Agent

modules/agent与modules/agentlayout只依赖model/agent。agentstate、deepseek/agent分别实现持久化及官方模型流；app注入现有metadata/query，不引入第二个Go module或内部HTTP。详细边界见[Agent](AGENT.md)。

app为Agent和工作台分别装配独立引擎客户端，隔离连接开关、请求取消及活动租约；元数据与查询仍复用现有业务模块，Agent的query执行范围通过WithExecutor沿用同一4并发预算。物理连接只归属单次操作，返回前释放；模型生成及写入确认期间不保留数据库连接。
