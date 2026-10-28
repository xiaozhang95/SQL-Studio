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

modules 各自只依赖 model 与最小消费接口，不导入兄弟模块、驱动、Gin 或存储实现。app 创建一次 query/ai 服务，全请求共享其预算。架构测试递归约束依赖与 README/doc.go。

## 请求和资源生命周期

HTTP context 传入模块和驱动，保留取消、超时、游标与连接释放。API 省略 allowWrite 时默认只读，SQL 窗口显式允许写入；请求保持单语句、1000 行（最多 5000）、约 8 MiB 内容；精确整数和 DECIMAL 保留文本。输入与状态码见 [接口列表](API.md)。

普通 JSON 请求限制 1 MiB，配置写入信封限制 32 MiB + 1024 字节。配置文件缺失可重建，现存文件严格 CAS，损坏或未知版本拒绝覆盖。密码不进入响应与日志；AI Key 仅保存在后端配置，响应脱敏。

Go 服务默认仅监听 127.0.0.1:8080，提供构建网页及 API。退出给予在途请求 5 秒结束时间。目录、启动、环境变量和测试入口见 [后端 README](../sql-studio-backend/README.md)。
