# 开发约定

先读 [项目 skill](../.agents/skills/sql-studio/SKILL.md)，再按任务进入 [前端源码](../sql-studio-frontend/src/README.md) 或 [后端包](../sql-studio-backend/internal/README.md) 和目标模块 README。技术栈与目录见 [项目框架](ARCHITECTURE.md)。

## 维护规则

- 前端遵守 [前端规范](FRONTEND_STANDARDS.md)：Ant Design 默认优先；局部布局用 style/styles，必要原生覆盖统一放 app.scss；共享外观使用 appearance。
- 后端遵守 [后端规范](BACKEND_STANDARDS.md)：业务模块独立、接口由消费方声明、app 单进程装配；HTTP 不承载业务或存储逻辑。
- 修改公开行为同步类型、调用方、模块 README、[API 列表](API.md) 和 [OpenAPI](../sql-studio-backend/internal/httpapi/openapi.json)。注释解释范围隔离、取消、凭据和修订等边界，不重复代码语法。
- 仅使用临时目录、测试替身和虚构数据回归；真实数据库集成需显式启用，并只操作随机临时库。保留用户连接、密钥和配置。

## 检查

在 sql-studio-frontend 执行：

```sh
pnpm format
pnpm lint
node --test tests/*.test.mjs
pnpm build
```

在 sql-studio-backend 执行：

```sh
gofmt -w .
gofmt -l .
go test -count=1 ./...
go vet ./...
go build ./...
```

UI 变更补充亮暗主题、长名称、伸缩布局和相关交互检查，证据保存在任务产物中。静态检查不能替代浏览器或真实数据库验证，交付时说明未覆盖范围。启动使用项目 README 中的原生命令，不增加包装脚本或部署配置。

SQL 窗口真实执行回归使用 [sql-studio-sql-regression skill](../.agents/skills/sql-studio-sql-regression/SKILL.md)，包含隔离环境、自动化命令、两种引擎的 SQL 示例、浏览器选区/快捷键/取消断言及清理流程；实际通过数量与未覆盖项随本次任务交付。
