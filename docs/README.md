# 项目文档

本目录只保留 SQL Studio 当前实现所需的说明。

| 文档 | 用途 |
| --- | --- |
| [功能汇总](FEATURES.md) | 当前完整功能清单、数据库差异及使用边界 |
| [项目框架](ARCHITECTURE.md) | 技术栈、目录、前后端调用和数据流 |
| [Electron 桌面项目](../sql-studio-electron/README.md) | 独立桌面项目、镜像、开发与安装包构建 |
| [接口列表](API.md) | HTTP 路由、Swagger 入口和公共约定 |
| [AI 助手源码导读](AGENT_GUIDE.md) | DeepSeek 请求、工具调用、SQL 权限、流式展示和会话保存 |
| [开发约定](DEVELOPMENT.md) | 开发入口与检查命令 |
| [前端规范](FRONTEND_STANDARDS.md) | Ant Design、样式、模块和类型规则 |
| [后端规范](BACKEND_STANDARDS.md) | 模块边界、接口、存储和检查规则 |
| [后端架构](BACKEND_ARCHITECTURE.md) | Go 包依赖、装配和生命周期 |
| [数据库](DATABASES.md) | MySQL 配置、行为和限制 |
| [用户状态](USER_STATE.md) | 配置文件、版本、修订和恢复 |

历史截图、过时回归流水账已移除；运行资源仍在前端 assets。回归结果随每次变更说明交付，不继续向 docs 追加过程记录。
