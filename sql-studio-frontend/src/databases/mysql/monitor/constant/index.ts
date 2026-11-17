import type { MonitorPanelConfig } from '@/typings/databaseMonitor'

export const monitorConfig = {
  title: '实例概览',
  overview: [
    {
      key: 'uptime',
      label: '运行时间',
      format: 'seconds'
    },
    {
      key: 'connections',
      label: '当前连接数',
      format: 'count'
    },
    {
      key: 'running_threads',
      label: '运行线程数',
      format: 'count'
    },
    {
      key: 'queries',
      label: '每秒客户端语句',
      format: 'countRate',
      source: 'counter'
    }
  ],
  activity: [
    {
      key: 'queries',
      label: '累计客户端语句',
      format: 'count'
    },
    {
      key: 'slow_queries',
      label: '累计慢查询',
      format: 'count'
    },
    {
      key: 'cache_hit_percent',
      label: '缓冲池命中率',
      format: 'percent'
    },
    {
      key: 'buffer_data_bytes',
      label: '缓冲池数据占用',
      format: 'bytes'
    },
    {
      key: 'buffer_dirty_bytes',
      label: '缓冲池脏数据',
      format: 'bytes'
    },
    {
      key: 'row_lock_waits',
      label: '当前行锁等待',
      format: 'count'
    },
    {
      key: 'failed_connections',
      label: '累计连接失败',
      format: 'count'
    },
    {
      key: 'temporary_disk_tables',
      label: '累计磁盘临时表',
      format: 'count'
    },
    {
      key: 'total_connections',
      label: '累计客户端连接',
      format: 'count'
    },
    {
      key: 'peak_connections',
      label: '峰值连接数',
      format: 'count'
    },
    {
      key: 'received_bytes',
      label: '累计接收流量',
      format: 'bytes'
    },
    {
      key: 'sent_bytes',
      label: '累计发送流量',
      format: 'bytes'
    }
  ],
  charts: [
    {
      key: 'queries',
      title: '语句执行趋势',
      series: [
        {
          key: 'queries',
          label: '每秒客户端语句',
          format: 'countRate',
          source: 'counter',
          tone: 'primary'
        },
        {
          key: 'slow_queries',
          label: '每秒慢查询',
          format: 'countRate',
          source: 'counter',
          tone: 'warning'
        }
      ]
    },
    {
      key: 'connections',
      title: '客户端连接趋势',
      series: [
        {
          key: 'connections',
          label: '当前连接数',
          format: 'count',
          tone: 'primary'
        },
        {
          key: 'running_threads',
          label: '运行线程数',
          format: 'count',
          tone: 'warning'
        }
      ]
    },
    {
      key: 'network',
      title: '网络吞吐趋势',
      series: [
        {
          key: 'received_bytes',
          label: '网络输入',
          format: 'rate',
          source: 'counter',
          tone: 'primary'
        },
        {
          key: 'sent_bytes',
          label: '网络输出',
          format: 'rate',
          source: 'counter',
          tone: 'link'
        }
      ]
    },
    {
      key: 'innodb',
      title: 'InnoDB 读写趋势',
      series: [
        {
          key: 'innodb_read_bytes',
          label: 'InnoDB 读取速率',
          format: 'rate',
          source: 'counter',
          tone: 'primary'
        },
        {
          key: 'innodb_written_bytes',
          label: 'InnoDB 写入速率',
          format: 'rate',
          source: 'counter',
          tone: 'warning'
        }
      ]
    }
  ],
  sectionLabels: {
    server: '服务器配置',
    connections: '连接与线程',
    statements: '语句统计',
    innodb: 'InnoDB 状态',
    network: '网络统计',
    statistics: '运行统计'
  },
  fields: {
    uptime: {
      label: '运行时间',
      format: 'seconds'
    },
    connections: {
      label: '当前连接数',
      format: 'count'
    },
    running_threads: {
      label: '运行线程数',
      format: 'count'
    },
    queries: {
      label: '累计客户端语句',
      format: 'count'
    },
    slow_queries: {
      label: '累计慢查询',
      format: 'count'
    },
    failed_connections: {
      label: '累计连接失败',
      format: 'count'
    },
    aborted_clients: {
      label: '异常断开客户端',
      format: 'count'
    },
    received_bytes: {
      label: '累计接收流量',
      format: 'bytes'
    },
    sent_bytes: {
      label: '累计发送流量',
      format: 'bytes'
    },
    total_connections: {
      label: '累计客户端连接',
      format: 'count'
    },
    peak_connections: {
      label: '峰值连接数',
      format: 'count'
    },
    threads_created: {
      label: '累计创建线程',
      format: 'count'
    },
    threads_cached: {
      label: '缓存线程数',
      format: 'count'
    },
    temporary_tables: {
      label: '累计临时表',
      format: 'count'
    },
    temporary_disk_tables: {
      label: '累计磁盘临时表',
      format: 'count'
    },
    select_statements: {
      label: '累计 SELECT 语句',
      format: 'count'
    },
    insert_statements: {
      label: '累计 INSERT 语句',
      format: 'count'
    },
    update_statements: {
      label: '累计 UPDATE 语句',
      format: 'count'
    },
    delete_statements: {
      label: '累计 DELETE 语句',
      format: 'count'
    },
    buffer_read_requests: {
      label: '缓冲池逻辑读取',
      format: 'count'
    },
    buffer_disk_reads: {
      label: '缓冲池物理读取',
      format: 'count'
    },
    buffer_data_bytes: {
      label: '缓冲池数据占用',
      format: 'bytes'
    },
    buffer_dirty_bytes: {
      label: '缓冲池脏数据',
      format: 'bytes'
    },
    buffer_pool_bytes: {
      label: '缓冲池容量',
      format: 'bytes'
    },
    innodb_read_bytes: {
      label: 'InnoDB 累计读取',
      format: 'bytes'
    },
    innodb_written_bytes: {
      label: 'InnoDB 累计写入',
      format: 'bytes'
    },
    row_lock_waits: {
      label: '当前行锁等待',
      format: 'count'
    },
    total_row_lock_waits: {
      label: '累计行锁等待',
      format: 'count'
    },
    row_lock_time_ms: {
      label: '累计行锁等待时间',
      format: 'milliseconds'
    },
    innodb_log_waits: {
      label: 'InnoDB 日志等待',
      format: 'count'
    },
    cache_hit_percent: {
      label: '缓冲池命中率',
      format: 'percent'
    },
    max_connections: {
      label: '连接数上限',
      format: 'count'
    },
    version: {
      label: '服务端版本',
      format: 'text'
    },
    version_comment: {
      label: '版本说明',
      format: 'text'
    },
    server_id: {
      label: '服务器 ID',
      format: 'count'
    },
    read_only: {
      label: '只读模式',
      format: 'flag'
    },
    innodb_buffer_pool_size: {
      label: '缓冲池配置容量',
      format: 'bytes'
    },
    innodb_page_size: {
      label: 'InnoDB 页大小',
      format: 'bytes'
    },
    wait_timeout: {
      label: '空闲连接超时',
      format: 'seconds'
    },
    thread_cache_size: {
      label: '线程缓存配置',
      format: 'count'
    },
    table_open_cache: {
      label: '表缓存配置',
      format: 'count'
    },
    log_bin: {
      label: '二进制日志已启用',
      format: 'flag'
    },
    slow_query_log: {
      label: '慢查询日志已启用',
      format: 'flag'
    },
    long_query_time: {
      label: '慢查询阈值',
      format: 'seconds'
    }
  },
  roleLabels: {
    'read-only': '只读',
    'read-write': '可写'
  },
  capacity: {
    used: 'connections',
    limit: 'max_connections',
    label: '连接上限使用率'
  }
} as const satisfies MonitorPanelConfig
