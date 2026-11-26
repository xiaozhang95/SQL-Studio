# Redis 连接配置

`redisProfile` 提供连接默认端口 6379、初始逻辑库 0 及可选用户名。连接表单可选单机、哨兵和集群，哨兵默认端口 26379。`redisModeLabel(mode)` 供查询工具栏及监控显示模式，旧连接缺省按单机。`selectedRedisDatabase(names, current?, preferred?)` 从已加载的编号中依次取当前库、连接偏好或首项。集群只提供 DB 0。Redis 命令和键浏览使用独立接口。键浏览和活跃频道共用[名称筛选模式](searchPattern/README.md)。命令编辑器使用[补全和分行规则](editor/README.md)。

[实例监控](monitor/README.md)通过统一引擎入口分派，组合概览、实际采样趋势、分类 INFO 状态和键空间表，不发起额外键扫描。
