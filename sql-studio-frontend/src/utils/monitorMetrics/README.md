# 监控采样取值与格式化

metricValue(snapshot,key) 返回原始字符串，缺失返回 undefined。formatMetric(value,format,locale) 处理精确整数、二进制容量、字节速率、次数速率、时间和百分比，未知或非有限数显示“—”。整数用 BigInt 保留精度，图表坐标才转为近似数。

sampleValue(history,index,metric) 对普通指标返回原值；source=counter 时按相邻采样的实际时间差求每秒速率。整数先用 BigInt 做差再转坐标，避免大累计值吞掉小增量；首次采样、缺失、非正时间差、计数回退或实例/统计重置返回 undefined，不补零或跨重置计算。

isMonitorReset(previous,next) 核对 Redis runId、通用 details.identity 及运行时间回退，用于隔离不同服务进程/统计周期的历史。方法纯读，不持久化、不执行网络请求。
