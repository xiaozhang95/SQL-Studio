# SQL Studio 项目指引

本仓库开发先读 [.agents/skills/sql-studio/SKILL.md](.agents/skills/sql-studio/SKILL.md)，再按任务读取实际模块 README。

前端任务继续读取并使用独立的 [sql-studio-frontend skill](.agents/skills/sql-studio-frontend/SKILL.md)，遵守 [前端开发规范](docs/FRONTEND_STANDARDS.md)：保留 Ant Design 默认样式，局部布局优先 style/styles，必要原生覆盖仅放 app.scss；同类组件统一尺寸、边框及弧度；组件/hooks/常量/枚举/接口/方法按功能独立入口及 README；优先共享只读定义和 TypeScript 类型约束；数据库实现按 mysql 等引擎独立封装，外层只组合与调用。

- 前端源码入口：[sql-studio-frontend/src/README.md](sql-studio-frontend/src/README.md)。
- 后端包入口：[sql-studio-backend/internal/README.md](sql-studio-backend/internal/README.md)。
- 后端任务使用 [sql-studio-backend skill](.agents/skills/sql-studio-backend/SKILL.md) 并遵守 [后端开发规范](docs/BACKEND_STANDARDS.md)：按业务模块独立接口、实现及文档，app 单进程装配；从后端根目录直接用 `go run main.go` 启动，当前不增加启停/检查包装脚本和部署配置。
- SQL 窗口执行回归使用 [sql-studio-sql-regression skill](.agents/skills/sql-studio-sql-regression/SKILL.md)，覆盖 MySQL/PostgreSQL 真实执行、选区快捷键、多结果、错误停止、取消和临时对象清理；静态/替身测试与浏览器实测分别报告。
- 业务表单必须采用左侧文本标签、右侧输入控件的横向布局；标签、校验和帮助说明遵守前端规范，不新增上下排列的表单。
- 用户当前要求优先。项目规范不要求额外审批，也不授权发送消息、部署、提交或修改业务数据。
