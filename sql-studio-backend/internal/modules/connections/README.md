# 连接管理模块

`New(repository Repository, database Database) *Service` 注入连接仓库和连通性测试能力。`ports.go` 定义本模块消费的最小接口，`service.go` 实现策略，测试与实现同包目录。

- `ListConnections() []model.Connection`：只列出支持的 MySQL 连接，归一化分组，不重写旧数据。
- `SaveConnection(model.Connection) (model.Connection, error)`：校验名称、主机、用户名、类型与 1–65535 端口；分组留空归入默认分组。空密码保留由仓库负责，返回值不得含明文密码。
- `DeleteConnection(id string) error`：删除显式目标连接，仓库错误原样返回。
- `ListGroups/CreateGroup/RenameGroup/MoveGroup`：共享分组列表、新建、原子重命名及连接移动；RenameGroup 返回 GroupState（groups、脱敏 connections），其余返回 string[] 或脱敏连接。分组及成员持久化由仓库负责，失败不返回成功；不调用 Database 或重置会话。
- `TestConnection(ctx context.Context, input model.Connection) (string, error)`：编辑时可复用已存密码，限制为 7 秒并继承调用者取消，返回数据库版本或错误。

仅服务端使用 `Repository.Get` 取凭据；不把凭据放入日志或响应，不访问 HTTP、文件系统或其他业务模块。app 创建模块并将其交给 HTTP 层；用临时仓库和测试替身验证，不连接业务数据库。

SetSession(ctx,id,database *string,open bool) 读取原始连接凭据，库名指定时不得为空，7 秒超时继承取消，调用引擎实际打开/关闭。nil 库表示整个连接；关闭必须等待资源释放，错误不转换为成功。

连接保存/测试/列表支持 mysql、postgresql；空类型仍兼容 mysql。PostgreSQL database 字段表示维护库，密码加密与空密码保留逻辑共用原存储。未支持类型留盘且不返回列表。

DeleteGroup(name) 返回 GroupState（最新分组与脱敏连接）；只更新本地归属，不关闭数据库会话、不删除连接。默认分组禁止删除。
