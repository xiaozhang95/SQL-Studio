# 真实 MySQL 回归

设置 SQLDESK_INTEGRATION=1 后执行 go test ./...。连接参数见后端 README。测试仅创建随机临时库并在结束后清理，不使用业务表；未启用时跳过，不将跳过报告为联调通过。
