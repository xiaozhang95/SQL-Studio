---
name: sql-studio
description: 维护本仓库 SQL Studio 的 Vite React Ant Design 前端、Gin Go 后端、数据库访问与配套文档；用于该项目开发、UI 调整、重构及归档检查。
---

# SQL Studio 项目开发

本 skill 只适用于本仓库。按任务读取实际模块 README，用户当前明确要求优先。

- 前端任务使用 [sql-studio-frontend](../sql-studio-frontend/SKILL.md)，遵守 [前端规范](../../../docs/FRONTEND_STANDARDS.md)，从 [源码索引](../../../sql-web/src/README.md) 进入实际模块。
- 后端任务使用 [sql-studio-backend](../sql-studio-backend/SKILL.md)，遵守 [后端规范](../../../docs/BACKEND_STANDARDS.md)，从 [架构](../../../docs/BACKEND_ARCHITECTURE.md) 和 [包索引](../../../sql-server/internal/README.md) 进入实际模块。
- 跨端功能同时维护 API、类型与公开行为，参见 [API 文档](../../../docs/API.md) 和 [开发约定](../../../docs/DEVELOPMENT.md)。数据库仅支持 MySQL，不套用历史多协议约定。

查询与结果始终归属发起页面和连接，旧请求取消/失效后不得覆盖新范围。密码只由后端加密管理，不进入前端持久化或日志；编辑空密码保留旧值。工作区加密快照不含连接密码，恢复不自动执行 SQL。后端保持默认只读、单语句与请求限制，前端多语句顺序调用单语句 API；取消不能描述为已回滚。

修改同步调用者、README、索引和契约。前端使用 pnpm format/lint/build，结构与文档检查已经归入原生 Node 测试；后端使用 gofmt 和 go test/vet/build，不再要求包装脚本。按行为变化验证，未执行的检查如实说明；使用隔离数据，不为满足检查访问业务表或改写凭据。项目规范不要求额外审批，也不授权提交、部署、发送消息或修改业务数据。
