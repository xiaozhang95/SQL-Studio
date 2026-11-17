# Redis 监控只读定义

导出 MetricFormat、MetricDefinition、TrendSeries 类型，以及 overviewMetrics、activityMetrics、trendCharts、sectionLabels、infoFields、chartLayout。定义概览及统计卡字段、四组图表的系列与主题色语义、状态分类及字段格式；不持有采样或可变状态。

容量以字节为基础，速率是字节/秒，TTL 是毫秒，日期为 Unix 秒；count 用于十进制整数字符串。字段缺失由展示层保持未知，不提供虚构默认值。INFO 字段含义见 [Redis 官方说明](https://redis.io/docs/latest/commands/info/)。
