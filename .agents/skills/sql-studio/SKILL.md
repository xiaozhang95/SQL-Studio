---
name: sql-studio
description: 维护本仓库 SQL Studio 的 Vite React Ant Design 前端、Gin Go 后端、数据库访问与配套文档；用于该项目开发、UI 调整、重构及归档检查。
---

# SQL Studio 项目开发

本 skill 只适用于本仓库。按任务读取实际模块 README，用户当前明确要求优先。项目显示名为 SQL Studio；前端目录和 npm package 均为 sql-studio-frontend，后端目录和 Go module 均为 sql-studio-backend，与对应 skill 名称一致；唯一程序入口位于后端根目录 main.go。

- 前端任务使用 [sql-studio-frontend](../sql-studio-frontend/SKILL.md)，遵守 [前端规范](../../../docs/FRONTEND_STANDARDS.md)，从 [源码索引](../../../sql-studio-frontend/src/README.md) 进入实际模块。
- 后端任务使用 [sql-studio-backend](../sql-studio-backend/SKILL.md)，遵守 [后端规范](../../../docs/BACKEND_STANDARDS.md)，从 [架构](../../../docs/BACKEND_ARCHITECTURE.md) 和 [包索引](../../../sql-studio-backend/internal/README.md) 进入实际模块。
- 跨端功能同时维护 API、类型与公开行为，参见 [API 文档](../../../docs/API.md) 和 [开发约定](../../../docs/DEVELOPMENT.md)。当前支持 MySQL 和 PostgreSQL/PolarDB，按实际引擎实现与契约维护。

查询与结果始终归属发起页面和连接，旧请求取消/失效后不得覆盖新范围。密码只由后端加密管理，不进入前端持久化或日志；编辑空密码保留旧值。工作区加密快照不含连接密码，恢复不自动执行 SQL。后端保持默认只读、单语句与请求限制，前端多语句顺序调用单语句 API；取消不能描述为已回滚。

修改同步调用者、README、索引和契约。前端使用 pnpm format/lint/build，结构与文档检查已经归入原生 Node 测试；后端使用 gofmt 和 go test/vet/build，不再要求包装脚本。按行为变化验证，未执行的检查如实说明；使用隔离数据，不为满足检查访问业务表或改写凭据。项目规范不要求额外审批，也不授权提交、部署、发送消息或修改业务数据。

- SQL 窗口回归使用 [sql-studio-sql-regression](../sql-studio-sql-regression/SKILL.md)，区分真实驱动/API、执行编排和浏览器验证，使用隔离临时对象并核验清理。

## Agent 操作模式（用户明确约定）

Agent仅有“只读模式”和“完全访问模式”，默认只读，切换必须提示权限和不可撤销风险。完全访问可查询、新增、修改及非删除结构操作，不再限定为简单INSERT/UPDATE。

任何模式均不得让AI执行DELETE、DROP、TRUNCATE、REPLACE或其他删除/清空数据和对象的操作，也不得通过多语句、动态SQL、存储程序等绕过。用户请求删除时，只提供命令、影响范围及数据丢失/不可恢复风险提示，让用户自行操作。后端必须校验，不以提示词为唯一防线。已有函数、触发器、级联约束可能产生间接副作用，须核对数据库配置；不宣称静态校验替代数据库权限隔离。

规则限定Agent，不改动普通SQL工作台能力；模式协议、标签、系统提示和文档一致。实现和测试使用隔离数据，不以完全访问模式为由擅自操作用户业务数据。

完全访问模式的每次新增、更新及非删除结构操作，都必须在执行前等待用户确认。弹窗展示连接、数据库、涉及表/对象和完整SQL（高亮、可复制）；模式切换确认不替代逐次执行确认。后端通过一次性随机确认ID绑定当前SQL和目标，未确认/取消/超时/断开均不执行，拒绝重复确认；取消结束本轮，模型不能自动重试。删除禁令保持不变。
