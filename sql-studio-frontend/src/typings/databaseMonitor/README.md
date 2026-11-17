# 监控展示契约

MetricFormat、MetricDefinition、TrendSeries 和 MonitorPanelConfig 约束共享概览/卡片、趋势系列及引擎配置。source='counter' 表示累计计数按相邻成功采样差值和实际秒数计算速率；普通系列直接展示采样值。countRate 为次数/秒，rate 为字节/秒，日期为 Unix 秒，milliseconds 为毫秒时长。

各引擎拥有字段、分类、角色和可选容量占比定义；共享组件不拼 SQL、不猜测引擎或缺失值。定义只读，不含可变采样、连接凭据或请求。MonitorPanelConfig.fields 仅用于状态明细，metrics 的数值保持十进制字符串。
