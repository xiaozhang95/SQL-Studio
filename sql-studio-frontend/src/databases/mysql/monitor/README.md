# MySQL 实例监控

默认导出 DatabaseMonitor(props:DatabaseMonitorPanelProps)，组合共享 MonitorPanel 与 [本引擎定义](constant/README.md)。概览为运行时间、当前连接、运行线程和每秒客户端语句；趋势为语句、连接/线程、收发网络及 InnoDB 读写。统计卡与分类详情覆盖连接、临时表、语句、缓冲池、行锁和网络；读取的是实例状态，不查询业务表。

计数速率需要两个实际采样，累计计数和缓冲池命中率保留原始口径；身份变化或 uptime 回退后清空旧序列。服务端变量读取失败保留基础状态并显示告警，未提供指标不填零。MariaDB 显式复用兼容定义，采样连接仍属于 MariaDB。
