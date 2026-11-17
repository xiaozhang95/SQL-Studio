export type MetricFormat = 'count' | 'bytes' | 'rate' | 'seconds' | 'milliseconds' | 'microseconds' | 'percent' | 'ratio' | 'date' | 'text' | 'flag'
export type MetricDefinition = { readonly key: string; readonly label: string; readonly format: MetricFormat }
export type TrendSeries = MetricDefinition & { readonly tone: 'primary' | 'warning' | 'secondary' | 'link' }

export const overviewMetrics = [
  { key: 'uptime', label: '运行时间', format: 'seconds' },
  { key: 'connections', label: '已连接客户端', format: 'count' },
  { key: 'redis_keys', label: '键总数', format: 'count' },
  { key: 'redis_memory_bytes', label: '内存占用', format: 'bytes' }
] as const satisfies readonly MetricDefinition[]

export const activityMetrics = [
  { key: 'redis_ops', label: '每秒处理命令', format: 'count' },
  { key: 'cache_hit_percent', label: '键查找命中率', format: 'percent' },
  { key: 'redis_memory_peak_bytes', label: '峰值内存', format: 'bytes' },
  { key: 'redis_fragmentation_ratio', label: '内存碎片比率', format: 'ratio' },
  { key: 'redis_commands', label: '累计执行命令', format: 'count' },
  { key: 'redis_total_connections', label: '累计客户端连接', format: 'count' },
  { key: 'redis_blocked_clients', label: '阻塞客户端', format: 'count' },
  { key: 'redis_rejected_connections', label: '累计拒绝连接', format: 'count' },
  { key: 'redis_expired', label: '累计过期键', format: 'count' },
  { key: 'redis_evicted', label: '累计淘汰键', format: 'count' },
  { key: 'received_bytes', label: '累计接收流量', format: 'bytes' },
  { key: 'sent_bytes', label: '累计发送流量', format: 'bytes' }
] as const satisfies readonly MetricDefinition[]

export const trendCharts = [
  { key: 'commands', title: '命令执行趋势', series: [{ key: 'redis_ops', label: '每秒处理命令', format: 'count', tone: 'primary' }] },
  { key: 'clients', title: '客户端连接趋势', series: [{ key: 'connections', label: '已连接客户端', format: 'count', tone: 'warning' }] },
  {
    key: 'memory',
    title: '内存使用趋势',
    series: [
      { key: 'redis_memory_bytes', label: '内存占用', format: 'bytes', tone: 'primary' },
      { key: 'redis_memory_rss_bytes', label: '进程驻留内存', format: 'bytes', tone: 'secondary' }
    ]
  },
  {
    key: 'network',
    title: '网络吞吐趋势',
    series: [
      { key: 'redis_input_bytes_per_sec', label: '网络输入', format: 'rate', tone: 'primary' },
      { key: 'redis_output_bytes_per_sec', label: '网络输出', format: 'rate', tone: 'link' }
    ]
  }
] as const satisfies readonly { key: string; title: string; series: readonly TrendSeries[] }[]

export const sectionLabels: Readonly<Record<string, string>> = {
  server: '服务器信息',
  clients: '客户端信息',
  memory: '内存信息',
  persistence: '持久化状态',
  replication: '复制状态',
  stats: '运行统计',
  cpu: 'CPU 累计耗时'
}

export const infoFields = {
  redis_version: { label: 'Redis 版本', format: 'text' },
  redis_mode: { label: '运行模式', format: 'text' },
  role: { label: '实例角色', format: 'text' },
  os: { label: '操作系统', format: 'text' },
  arch_bits: { label: '架构位数', format: 'count' },
  process_id: { label: '进程 ID', format: 'count' },
  tcp_port: { label: '监听端口', format: 'count' },
  uptime_in_seconds: { label: '运行时间', format: 'seconds' },
  hz: { label: '后台任务频率', format: 'count' },
  io_threads_active: { label: 'I/O 线程活跃', format: 'flag' },
  connected_clients: { label: '已连接客户端', format: 'count' },
  maxclients: { label: '最大客户端数', format: 'count' },
  blocked_clients: { label: '阻塞客户端', format: 'count' },
  tracking_clients: { label: '跟踪客户端', format: 'count' },
  client_recent_max_input_buffer: { label: '客户端最大输入缓冲', format: 'bytes' },
  client_recent_max_output_buffer: { label: '客户端最大输出缓冲', format: 'bytes' },
  used_memory: { label: '内存占用', format: 'bytes' },
  used_memory_rss: { label: '进程驻留内存', format: 'bytes' },
  used_memory_peak: { label: '峰值内存', format: 'bytes' },
  used_memory_dataset: { label: '数据集内存', format: 'bytes' },
  used_memory_overhead: { label: '管理开销内存', format: 'bytes' },
  maxmemory: { label: '内存上限', format: 'bytes' },
  maxmemory_policy: { label: '内存淘汰策略', format: 'text' },
  mem_fragmentation_ratio: { label: '内存碎片比率', format: 'ratio' },
  allocator_frag_ratio: { label: '分配器碎片比率', format: 'ratio' },
  active_defrag_running: { label: '正在内存整理', format: 'flag' },
  loading: { label: '正在加载数据', format: 'flag' },
  rdb_changes_since_last_save: { label: 'RDB 保存后变更数', format: 'count' },
  rdb_bgsave_in_progress: { label: 'RDB 正在后台保存', format: 'flag' },
  rdb_last_save_time: { label: '最近 RDB 保存时间', format: 'date' },
  rdb_last_bgsave_status: { label: '最近 RDB 保存状态', format: 'text' },
  rdb_last_bgsave_time_sec: { label: '最近 RDB 保存耗时', format: 'seconds' },
  aof_enabled: { label: 'AOF 已启用', format: 'flag' },
  aof_rewrite_in_progress: { label: 'AOF 正在重写', format: 'flag' },
  aof_last_bgrewrite_status: { label: '最近 AOF 重写状态', format: 'text' },
  aof_last_write_status: { label: '最近 AOF 写入状态', format: 'text' },
  aof_current_size: { label: 'AOF 当前大小', format: 'bytes' },
  aof_base_size: { label: 'AOF 基准大小', format: 'bytes' },
  connected_slaves: { label: '已连接副本数', format: 'count' },
  master_link_status: { label: '主库连接状态', format: 'text' },
  master_last_io_seconds_ago: { label: '距主库最近通信', format: 'seconds' },
  master_sync_in_progress: { label: '正在主从同步', format: 'flag' },
  slave_read_only: { label: '副本只读', format: 'flag' },
  master_repl_offset: { label: '主库复制偏移', format: 'count' },
  slave_repl_offset: { label: '副本复制偏移', format: 'count' },
  repl_backlog_size: { label: '复制积压缓冲', format: 'bytes' },
  total_connections_received: { label: '累计客户端连接', format: 'count' },
  total_commands_processed: { label: '累计执行命令', format: 'count' },
  instantaneous_ops_per_sec: { label: '每秒处理命令', format: 'count' },
  total_net_input_bytes: { label: '累计接收流量', format: 'bytes' },
  total_net_output_bytes: { label: '累计发送流量', format: 'bytes' },
  instantaneous_input_kbps: { label: '网络输入', format: 'text' },
  instantaneous_output_kbps: { label: '网络输出', format: 'text' },
  rejected_connections: { label: '累计拒绝连接', format: 'count' },
  expired_keys: { label: '累计过期键', format: 'count' },
  evicted_keys: { label: '累计淘汰键', format: 'count' },
  keyspace_hits: { label: '键查找命中次数', format: 'count' },
  keyspace_misses: { label: '键查找未命中次数', format: 'count' },
  pubsub_channels: { label: '活跃订阅频道', format: 'count' },
  pubsub_patterns: { label: '模式订阅数', format: 'count' },
  total_error_replies: { label: '累计错误回复', format: 'count' },
  latest_fork_usec: { label: '最近 Fork 耗时', format: 'microseconds' },
  used_cpu_sys: { label: '系统态 CPU 耗时', format: 'seconds' },
  used_cpu_user: { label: '用户态 CPU 耗时', format: 'seconds' },
  used_cpu_sys_children: { label: '子进程系统态 CPU 耗时', format: 'seconds' },
  used_cpu_user_children: { label: '子进程用户态 CPU 耗时', format: 'seconds' }
} as const satisfies Readonly<Record<string, { label: string; format: MetricFormat }>>

export const chartLayout = { width: 640, height: 250, left: 92, right: 20, top: 16, bottom: 32 } as const
