# PostgreSQL / PolarDB 监控

默认导出 DatabaseMonitor(props:DatabaseMonitorPanelProps)，组合 MonitorPanel 与 [本引擎定义](constant/README.md)。概览展示所选库连接、可见活跃会话、库大小和缓存命中率；四组趋势展示事务、会话、数据块访问和数据行变更。分类明细包含启动/统计重置时间、参数、事务、缓存与临时文件、锁和估算元组/维护统计。

采用数据库范围，不把 MySQL 网络或 InnoDB 指标套入 PostgreSQL。实例 max_connections 仅在明细显示，不将单库连接占用误标为整个实例使用率。会话状态受账号可见权限限制，状态不可见会话独立计数；数据块读取可能命中 OS 缓存，不当作实际磁盘吞吐。死元组/存活行数是估算值。统计重置或进程变化开始新序列，累计值回退不计算负速率。
