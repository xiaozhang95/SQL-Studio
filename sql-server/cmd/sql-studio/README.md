# 服务启动入口

main.go 读取 config、创建 app、处理进程退出。只负责启动装配，不承载 HTTP handler、SQL 或密码存储。

从后端根目录执行 `go run ./cmd/sql-studio`；构建/后台运行使用项目根目录 原生命令（前端 pnpm dev，后端 go run ./cmd/sql-studio）。
