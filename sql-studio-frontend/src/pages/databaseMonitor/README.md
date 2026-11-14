# 监控指标

`/monitor` 可从工作区顶栏或连接右键菜单进入。页面接收已保存的 `connections`、可选 `initialConnection`、`initialDatabase` 及共享页面布局参数。连接右键直接带入所选连接，顶栏优先使用对象树或当前页签的范围；无有效范围时选择首个连接。

MySQL 和 MariaDB 显示实例统计，PostgreSQL 和 GreptimeDB 可切换数据库。指标卡按宽度排列，支持查看采样时间和手动刷新。计数保留大整数精度，容量和流量按二进制单位展示。连接与采样由 [useDatabaseMonitor](hooks/useDatabaseMonitor/README.md) 管理。
