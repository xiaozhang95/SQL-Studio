# 同步连接字段

DatabaseSyncConnection 在同步表单中复用源端和目标端的连接选择。side 决定标签和输入 ID。选择外部连接时显示主机、端口、用户名、密码及 TLS 证书校验开关。值由 useDatabaseSync 控制。

端口占位提示取所选引擎的默认值，留空使用该端口。PostgreSQL 和 GreptimeDB 提示维护数据库默认值，GreptimeDB 未启用认证时可留空用户名。切换引擎清空两端选择、临时凭据、库名和已有检查结果。
