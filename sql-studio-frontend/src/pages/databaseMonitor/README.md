# 监控指标

`/monitor` 可从工作区顶栏或连接右键菜单进入。页面接收已保存的 `connections`、可选 `initialConnection`、`initialDatabase` 及共享页面布局参数。连接右键直接带入所选连接，顶栏优先使用对象树或当前页签的范围；无有效范围时选择首个连接。

MySQL 和 MariaDB 显示实例统计，PostgreSQL 和 GreptimeDB 可切换数据库。连接和数据库使用无可见标签的下拉框。指标卡使用宽松的内边距与字号，窄屏显示两列、宽屏显示四列。页面显示采样时间。手动刷新始终可用，自动刷新默认关闭，可选 5 秒、15 秒、30 秒、1 分钟、5 分钟。计数保留大整数精度，容量和流量按二进制单位展示。连接与采样由 [useDatabaseMonitor](hooks/useDatabaseMonitor/README.md) 管理。
