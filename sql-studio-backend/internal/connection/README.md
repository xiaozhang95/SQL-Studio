# 本地连接仓库

[包索引](../README.md) · [架构说明](../../../docs/BACKEND_ARCHITECTURE.md)

## 职责

Open/List/Get/Save/Delete 管理连接，AES-GCM 加密密码并原子落盘。

Groups/CreateGroup/RenameGroup/MoveGroup 管理独立分组及成员归属。connections.json 保存 `{connections:Connection[],groups:string[]}`，只读取包含 connections/groups 数组的当前对象文档，保存时保留当前 ID 和密码密文。Groups 包含默认分组和空分组；保存新连接的自由输入分组自动登记，最后一个成员移走或删除后仍保留空分组。

重命名在一次文件原子替换中更新分组及全部成员；移动只更新 Group，保留其他字段及密码密文。名称去首尾空白，拒绝空名、控制字符和重复名称；默认分组不可重命名，移动目标必须已存在。不存在返回 os.ErrNotExist；写入失败不更新内存。所有操作由同一把锁串行化，不操作数据库会话。

## 约束与调用

List 必须移除密码；编辑空密码保留原值；密钥丢失拒绝覆盖已有配置；不记录明文密码。

连接文档必须明确保存 type/group；新建连接的空分组输入初始化为当前默认分组。读取不补旧字段，不解析连接数组格式。

实现按 connection/metadata/query 等职责分文件，测试同目录；包外只使用实际导出方法。修改公开参数/错误行为时同步 model、httpapi、API 文档及相关测试。真实服务回归入口为 go test ./...、go vet ./... 和 go build ./...，集成参数见后端 README。

当前仓库不包含跨目录迁移方法，也不读取其他目录中的连接或密钥文件。

DeleteGroup(name) 原子删除自定义分组并将其全部成员移至默认分组，连接 ID、密码密文及其他连接字段保持原样。空分组同样支持删除，默认分组禁止删除，不存在返回 os.ErrNotExist；写入失败同时保留分组和成员状态。
