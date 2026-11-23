---
name: sql-studio
description: 维护本仓库 SQL Studio 的 Vite React Ant Design 前端、Gin Go 后端、数据库访问与配套文档；用于该项目开发、UI 调整、重构及归档检查。
---

# SQL Studio 项目开发

本 skill 只适用于本仓库。按任务读取实际模块 README，用户当前明确要求优先。项目显示名为 SQL Studio；前端目录和 npm package 均为 sql-studio-frontend，后端目录和 Go module 均为 sql-studio-backend，与对应 skill 名称一致；唯一程序入口位于后端根目录 main.go。

- 前端任务使用 [sql-studio-frontend](../sql-studio-frontend/SKILL.md)，遵守 [前端规范](../../../docs/FRONTEND_STANDARDS.md)，从 [源码索引](../../../sql-studio-frontend/src/README.md) 进入实际模块。
- 后端任务使用 [sql-studio-backend](../sql-studio-backend/SKILL.md)，遵守 [后端规范](../../../docs/BACKEND_STANDARDS.md)，从 [架构](../../../docs/BACKEND_ARCHITECTURE.md) 和 [包索引](../../../sql-studio-backend/internal/README.md) 进入实际模块。
- 跨端功能同时维护 API、类型与公开行为，参见 [API 文档](../../../docs/API.md) 和 [开发约定](../../../docs/DEVELOPMENT.md)。当前连接类型包括 MySQL、MariaDB、PostgreSQL（含 PolarDB PostgreSQL）、GreptimeDB 和 Redis，具体能力见 [数据库说明](../../../docs/DATABASES.md)。

查询与结果始终归属发起页面和连接，旧请求取消或失效后不得覆盖新范围。密码只由后端加密管理，不进入前端持久化、日志或工作区索引与分片。编辑时留空保留旧密码。工作区恢复不自动执行 SQL。单语句 API 默认只读，工作台显式允许写入。MySQL、MariaDB 和 PostgreSQL 的多语句脚本通过批次 API 在同一会话内逐条执行。取消后保留已收到的结果与已提交的写入。

## 文档维护

前后端变更均须同步调用者、模块 README、父级索引、用户文档及相关接口契约。以当前源码和配置核对受影响的入口、默认值、支持范围及行为，在原有章节直接替换过期说明、删除失效内容并合并重复描述。当前文档保持可独立阅读，避免在末尾追加补充、日期更新或修复记录来覆盖前文。交付前复查相关文档间的一致性与本地链接。

## 交付前检查

**修改完成后默认核对源码、改动差异和受影响的文档，用户自行运行和调试。** 仅当用户明确要求时，才在指定范围启动应用、执行构建、lint 或测试、操作浏览器、连接数据库联调或回归。代码格式化按改动文件进行。

- 用户明确要求 SQL 窗口实测时使用 [sql-studio-sql-regression](../sql-studio-sql-regression/SKILL.md)。使用隔离临时对象，分别报告真实驱动/API、执行编排和浏览器证据，并核验清理。

## 交付与 Git 提交日志

每次完成代码修改后评估本次改动是否适合发版。适合时，在交付前主动按变更幅度递增 [前端 package.json](../../../sql-studio-frontend/package.json) 的 `version`，并在最终回复中写明新版本号。Web 和 Electron 共用这个版本号。

每次完成代码修改后，最终回复主动附上一份可直接复制的 Git 提交日志，包含简洁标题和必要的变更要点。先核对当前分支的实际提交记录、暂存区和工作区，判断此前改动是否已经提交。

此前提供的日志尚未用于提交时，每次重新生成一份总日志，合并此前仍未提交的相关改动和本轮改动。已提交的部分从后续日志中排除，已撤回的改动不计入。以当前实际差异为准，生成一个统一标题与合并后的要点。

仅提供提交日志文本。git add、git commit 和 git push 由用户明确授权后执行。

## Agent 操作模式（用户明确约定）

Agent仅有“只读模式”和“完全访问模式”，默认只读，切换必须提示权限和不可撤销风险。完全访问可查询、新增、修改及非删除结构操作，不再限定为简单INSERT/UPDATE。

任何模式均不得让AI执行DELETE、DROP、TRUNCATE、REPLACE或其他删除/清空数据和对象的操作，也不得通过多语句、动态SQL、存储程序等绕过。用户请求删除时，只提供命令、影响范围及数据丢失/不可恢复风险提示，让用户自行操作。后端必须校验，不以提示词为唯一防线。已有函数、触发器、级联约束可能产生间接副作用，须核对数据库配置；不宣称静态校验替代数据库权限隔离。

规则限定Agent，不改动普通SQL工作台能力；模式协议、标签、系统提示和文档一致。实现和测试使用隔离数据，不以完全访问模式为由擅自操作用户业务数据。

完全访问模式的每次新增、更新及非删除结构操作，都必须在执行前等待用户确认。当前回复下方的确认卡片展示连接、数据库、涉及对象和完整 SQL（高亮、可复制）；模式切换确认不替代逐次执行确认。后端通过一次性随机确认ID绑定当前SQL和目标，未确认/取消/超时/断开均不执行，拒绝重复确认；取消结束本轮，模型不能自动重试。删除禁令保持不变。
