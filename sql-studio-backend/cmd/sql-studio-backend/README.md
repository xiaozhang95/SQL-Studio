# 服务启动入口

main.go 读取 config、创建 app、处理进程退出。只负责启动装配，不承载 HTTP handler、SQL 或密码存储。

从后端根目录执行 `go run ./cmd/sql-studio-backend/main.go`，日志输出当前终端，Ctrl+C 结束。当前不提供后台运行、启停脚本或部署配置；构建与检查直接使用 go build/test/vet。
