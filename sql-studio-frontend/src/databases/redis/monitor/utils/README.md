# Redis 指标格式化

`metricValue(snapshot,key)` 返回指定采样的原始字符串，未找到返回 undefined。`formatMetric(value,format,locale)` 按 MetricFormat 格式化整数、二进制容量、字节速率、秒/毫秒时长、微秒、百分比及 Unix 日期。整数用 BigInt 保留精度；缺失或非有限数显示“—”，不发请求。

`formatInfoField(key,value,locale,t)` 按字段定义显示状态，maxmemory=0 显示不限制；INFO 网络 KB/s 转为字节/秒后按容量单位展示，布尔、正常/失败和主库连接状态使用翻译文案。纯方法不持有缓存或修改传入采样。
