# MariaDB 实例监控

MariaDBMonitor(props:DatabaseMonitorPanelProps) 使用当前 MariaDB 连接的独立采样，组合共享 MonitorPanel，显式复用 [MySQL 兼容状态定义](../../mysql/monitor/constant/README.md)。提供相同的概览、语句/连接/网络/InnoDB 趋势、统计卡和分类明细；不把连接类型转换成 MySQL。版本差异导致的缺失变量保持未知。
