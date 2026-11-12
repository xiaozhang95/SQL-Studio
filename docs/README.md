# 项目文档

以下文档描述 SQL Studio 的当前实现。

| 文档 | 用途 |
| --- | --- |
| [功能汇总](FEATURES.md) | 当前完整功能清单、数据库差异及使用边界 |
| [项目框架](ARCHITECTURE.md) | 技术栈、目录、前后端调用和数据流 |
| [Electron 桌面项目](../sql-studio-electron/README.md) | 独立桌面项目、镜像、开发与安装包构建 |
| [接口列表](API.md) | HTTP 路由、Swagger 入口和公共约定 |
| [数据库 Agent](AGENT.md) | AI 助手的操作模式、界面和会话 |
| [AI 助手源码导读](AGENT_GUIDE.md) | DeepSeek 请求、工具调用、SQL 权限、流式展示和会话保存 |
| [开发约定](DEVELOPMENT.md) | 开发入口与检查命令 |
| [前端规范](FRONTEND_STANDARDS.md) | Ant Design、样式、模块和类型规则 |
| [后端规范](BACKEND_STANDARDS.md) | 模块边界、接口、存储和检查规则 |
| [后端架构](BACKEND_ARCHITECTURE.md) | Go 包依赖、装配和生命周期 |
| [数据库](DATABASES.md) | MySQL、MariaDB、PostgreSQL / PolarDB 的配置、行为和限制 |
| [用户状态](USER_STATE.md) | 配置文件、版本、修订和恢复 |

历史资料见 [Agent 合并验证](AGENT_VERIFICATION.md)、[2026-11-03 Agent 归档](AGENT_ARCHIVE_2026-11-03.md) 和 [2026-11-05 代码审查](REVIEW_2026-11-05.md)。
