# Redis INFO 状态格式化

formatInfoField(key,value,locale,t) 按 Redis 字段定义显示状态，maxmemory=0 表示不限制，INFO KB/s 转为字节速率；布尔、正常/失败和主库连接状态使用翻译。通用取值与数字/容量/时间格式化移至 [monitorMetrics](../../../../utils/monitorMetrics/README.md)，本模块仅保留 Redis 语义，不发请求或持有缓存。
