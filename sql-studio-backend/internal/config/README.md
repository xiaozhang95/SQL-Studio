# 运行配置

[包索引](../README.md) · [架构说明](../../../docs/BACKEND_ARCHITECTURE.md)

## 职责

统一读取环境变量与解析数据/网页目录，校验首次连接参数。

## 约束与调用

下层通过参数接收配置，不在 handler 或业务模块 中重复读取环境变量。

实现按 connection/metadata/query 等职责分文件，测试同目录；包外只使用实际导出方法。修改公开参数/错误行为时同步 model、httpapi、API 文档及相关测试。真实服务回归入口为 go test ./...、go vet ./... 和 go build ./...，集成参数见后端 README。

StateDir/SQLDESK_STATE_DIR 默认 os.UserHomeDir()/.sql-studio/state，允许覆盖；未指定 SQLDESK_DATA_DIR 时，连接和密钥与状态使用同一目录。

项目名称统一为 SQL Studio；新配置目录为 `.sql-studio/state`，已存在 `.sqloom/state` 且无新目录时继续读取旧目录。旧 `SQLDESK_*` 环境变量和浏览器存储键保留兼容。

Config.DataDir 默认等于 StateDir，LegacyDataDir 仅在未设置 SQLDESK_DATA_DIR 时指向启动工作目录的 data/，app 启动前调用连接仓库迁移。显式数据目录保留原语义，LegacyDataDir 为空，不自动移动；Load 自身不写入文件。

WebDir 默认空，由 webui 按构建方式选择内嵌 dist 或开发磁盘目录；仅显式设置 SQLDESK_WEB_DIR 时解析为绝对路径并覆盖默认来源。打包版不依赖启动目录寻找网页。

Address/SQLDESK_ADDR 默认 `127.0.0.1:8080`，可显式改为例如 `127.0.0.1:18080`；地址有效性由 HTTP listener 在启动时检查，错误直接返回，不占用其他端口重试。

main.go 输出实际 PID、exe 路径、监听地址及原配置目录，便于确认浏览器对应哪个后端。默认目录保持不变，不以更换目录处理写入被拒绝。
