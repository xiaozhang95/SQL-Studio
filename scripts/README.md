# 项目检查脚本

`node scripts/check-structure.mjs` 检查前端独立模块入口、前后端 README 和 Markdown 本地链接；`--frontend` 只检查前端模块与对应链接。它只读，不扫描 data、凭据、node_modules 或构建目录。

前端 pnpm lint 集成前端检查；后端继续使用 Go 原生架构测试，避免给独立 Go 开发引入 Node 运行依赖。
