# 本地连接仓库

[包索引](../README.md) · [架构说明](../../../docs/BACKEND_ARCHITECTURE.md)

## 职责

Open/List/Get/Save/Delete 管理连接，AES-GCM 加密密码并原子落盘。

## 约束与调用

List 必须移除密码；编辑空密码保留原值；密钥丢失拒绝覆盖已有配置；不记录明文密码。

实现按 connection/metadata/query 等职责分文件，测试同目录；包外只使用实际导出方法。修改公开参数/错误行为时同步 model、httpapi、API 文档及相关测试。真实服务回归入口为 go test ./...、go vet ./... 和 go build ./...，集成参数见后端 README。
