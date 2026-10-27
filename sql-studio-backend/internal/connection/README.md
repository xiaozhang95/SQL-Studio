# 本地连接仓库

[包索引](../README.md) · [架构说明](../../../docs/BACKEND_ARCHITECTURE.md)

## 职责

Open/List/Get/Save/Delete 管理连接，AES-GCM 加密密码并原子落盘。

## 约束与调用

List 必须移除密码；编辑空密码保留原值；密钥丢失拒绝覆盖已有配置；不记录明文密码。

分组名称作为 Connection.group 和其他公开连接字段一同落盘、读取、编辑；旧文件缺少该字段时由 connections 业务模块读取为“默认分组”，无需改写旧文件。

实现按 connection/metadata/query 等职责分文件，测试同目录；包外只使用实际导出方法。修改公开参数/错误行为时同步 model、httpapi、API 文档及相关测试。真实服务回归入口为 go test ./...、go vet ./... 和 go build ./...，集成参数见后端 README。

Migrate(source,destination) 在启动时迁移旧连接配置和原密钥；逐项比较目标文件，冲突、缺密钥或解密失败时停止。仅以独占创建方式写入缺失目标，不覆盖已有不同数据；Sync 后验证两文件字节、所有密码解密和源未变化，再删除旧两文件并尝试移除空目录，其他文件保留。中断后相同文件可重试，保留原始密文和连接 ID。只有一个后端进程拥有目录，升级迁移前必须停止旧服务。
