# Redis 实例监控

`RedisMonitor({snapshot,history})` 经 [getDatabaseMonitorPanel](../../README.md) 在监控页组合，参数遵守 [DatabaseMonitorPanelProps](../../typings/README.md)。snapshot 为当前真实采样，history 为当前连接的有界成功采样序列，不发请求、不保存数据。

顶部显示版本、运行模式、角色，以及运行时间、已连接客户端、键总数、内存。配置内存上限时显示使用比例，maxmemory=0 不显示上限占比。活动状态包含命令/秒、客户端、内存/RSS、网络输入/输出四组趋势和十二项统计卡；状态信息显示逻辑库键空间表及服务器、客户端、内存、持久化、复制、运行统计和 CPU 累计耗时。

趋势仅覆盖本次打开页面后成功采样的数据，自动刷新默认仍关闭。首次采样仅画实际点，不填充历史；缺失指标显示“—”或空态，不补零；无查找记录时命中率未知。卡片和状态表保留整数精度，图表坐标允许近似。计数是本节点实例级统计，Cluster 不汇总其他节点；键空间仅列出 INFO 返回的非空逻辑库，不扫描键。

- [组件](components/README.md)：趋势图与状态详情。
- [定义](constant/README.md)：指标、字段、图例及图表尺寸。
- [格式化](utils/README.md)：Redis 状态语义；数字格式化和趋势复用共享 monitorMetrics/monitorTrendChart。
