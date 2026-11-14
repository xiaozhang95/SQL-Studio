# 数据库监控采样

`useDatabaseMonitor(connections, initialConnection, initialDatabase)` 初始化时使用传入连接和库，未指定连接时使用第一个已保存连接。PostgreSQL 和 GreptimeDB 空库值使用连接默认库。返回当前连接、库列表、采样结果与错误，以及 `selectConnection`、`selectDatabase`、`refresh`。

打开页面时立即采样，每次响应结束后间隔 15 秒刷新。更换范围或离开页面会取消在途请求并停止定时器。单次读取失败保留同一范围的上一份统计与采样时间。
