# 工作区连接列表

useWorkspaceConnections(onLoaded) 管理 connections/setConnections、保存的分组名称和去重 groups、connectionLoading/connectionError/loadConnections。首次并行读取连接及分组，卸载取消请求；成功调用 onLoaded 校正查询页连接范围，失败保留原列表和错误。手动 loadConnections 用于创建、删除及失败恢复。此 hook 不持有 SQL 执行、数据库物理连接或工作区持久化。
