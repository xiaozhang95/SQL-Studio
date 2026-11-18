# 数据库监控采样

`useDatabaseMonitor(connections, initialConnection, initialDatabase)` 初始化时使用传入连接和库，未指定连接时使用第一个已保存连接。PostgreSQL 和 GreptimeDB 空库值使用连接默认库。返回当前连接、库列表、采样结果与错误，以及 `selectConnection`、`selectDatabase`、`refresh`。

打开页面时立即采样，refreshInterval 默认 5 秒；每次进入重新使用该默认值。在每次采样完成时按所选间隔安排下一次采样，避免请求重叠；失败后也按间隔重试。首次采样保留速率指标的断点，第二次成功采样后按实际间隔计算。手动刷新重新开始计时，选择 0 关闭自动刷新会清除定时器。更换范围或离开页面会取消在途请求。单次读取失败保留同一范围的上一份统计、采样时间和历史，不插入失败点。result.history 最多保留最近 120 次成功采样，同一时间戳替换；更换连接/数据库立即取消旧采样并清空历史，Redis runId、SQL 引擎 details.identity 改变，或运行时间回退时，也从新序列开始，避免进程重启、故障切换和统计重置混入旧序列。离开页面卸载后不保留，历史不写入工作区配置。
