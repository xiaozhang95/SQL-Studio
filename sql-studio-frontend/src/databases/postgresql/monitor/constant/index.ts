import type { MonitorPanelConfig } from '@/typings/databaseMonitor'

export const monitorConfig = {
  title: '数据库概览',
  overview: [
    {
      key: 'connections',
      label: '当前连接数',
      format: 'count'
    },
    {
      key: 'active_sessions',
      label: '可见活跃会话',
      format: 'count'
    },
    {
      key: 'size_bytes',
      label: '数据库大小',
      format: 'bytes'
    },
    {
      key: 'cache_hit_percent',
      label: '缓存命中率',
      format: 'percent'
    }
  ],
  activity: [
    {
      key: 'transactions_committed',
      label: '累计提交事务',
      format: 'count'
    },
    {
      key: 'transactions_rolled_back',
      label: '累计回滚事务',
      format: 'count'
    },
    {
      key: 'deadlocks',
      label: '累计死锁',
      format: 'count'
    },
    {
      key: 'temp_bytes',
      label: '累计临时文件写入',
      format: 'bytes'
    },
    {
      key: 'idle_transaction_sessions',
      label: '可见空闲事务会话',
      format: 'count'
    },
    {
      key: 'unknown_sessions',
      label: '状态不可见会话',
      format: 'count'
    },
    {
      key: 'estimated_live_rows',
      label: '估算存活行数',
      format: 'count'
    },
    {
      key: 'estimated_dead_rows',
      label: '估算死元组数',
      format: 'count'
    },
    {
      key: 'rows_inserted',
      label: '累计插入行数',
      format: 'count'
    },
    {
      key: 'rows_updated',
      label: '累计更新行数',
      format: 'count'
    },
    {
      key: 'rows_deleted',
      label: '累计删除行数',
      format: 'count'
    },
    {
      key: 'waiting_locks',
      label: '等待锁记录',
      format: 'count'
    }
  ],
  charts: [
    {
      key: 'transactions',
      title: '事务处理趋势',
      series: [
        {
          key: 'transactions_committed',
          label: '每秒提交事务',
          format: 'countRate',
          source: 'counter',
          tone: 'primary'
        },
        {
          key: 'transactions_rolled_back',
          label: '每秒回滚事务',
          format: 'countRate',
          source: 'counter',
          tone: 'warning'
        }
      ]
    },
    {
      key: 'sessions',
      title: '会话活动趋势',
      series: [
        {
          key: 'connections',
          label: '当前连接数',
          format: 'count',
          tone: 'primary'
        },
        {
          key: 'active_sessions',
          label: '可见活跃会话',
          format: 'count',
          tone: 'link'
        },
        {
          key: 'idle_transaction_sessions',
          label: '可见空闲事务会话',
          format: 'count',
          tone: 'warning'
        }
      ]
    },
    {
      key: 'blocks',
      title: '数据块访问趋势',
      series: [
        {
          key: 'blocks_read',
          label: '每秒读取数据块',
          format: 'countRate',
          source: 'counter',
          tone: 'primary'
        },
        {
          key: 'blocks_hit',
          label: '每秒命中数据块',
          format: 'countRate',
          source: 'counter',
          tone: 'link'
        }
      ]
    },
    {
      key: 'rows',
      title: '数据行变更趋势',
      series: [
        {
          key: 'rows_inserted',
          label: '每秒插入行数',
          format: 'countRate',
          source: 'counter',
          tone: 'primary'
        },
        {
          key: 'rows_updated',
          label: '每秒更新行数',
          format: 'countRate',
          source: 'counter',
          tone: 'link'
        },
        {
          key: 'rows_deleted',
          label: '每秒删除行数',
          format: 'countRate',
          source: 'counter',
          tone: 'warning'
        }
      ]
    }
  ],
  sectionLabels: {
    server: '服务器配置',
    sessions: '会话与锁',
    transactions: '事务统计',
    storage: '存储与缓存',
    rows: '数据行统计',
    maintenance: '扫描与维护',
    statistics: '运行统计'
  },
  fields: {
    connections: {
      label: '当前连接数',
      format: 'count'
    },
    active_sessions: {
      label: '可见活跃会话',
      format: 'count'
    },
    idle_sessions: {
      label: '可见空闲会话',
      format: 'count'
    },
    idle_transaction_sessions: {
      label: '可见空闲事务会话',
      format: 'count'
    },
    unknown_sessions: {
      label: '状态不可见会话',
      format: 'count'
    },
    transactions_committed: {
      label: '累计提交事务',
      format: 'count'
    },
    transactions_rolled_back: {
      label: '累计回滚事务',
      format: 'count'
    },
    size_bytes: {
      label: '数据库大小',
      format: 'bytes'
    },
    cache_hit_percent: {
      label: '缓存命中率',
      format: 'percent'
    },
    deadlocks: {
      label: '累计死锁',
      format: 'count'
    },
    temp_bytes: {
      label: '累计临时文件写入',
      format: 'bytes'
    },
    rows_changed: {
      label: '累计变更行数',
      format: 'count'
    },
    blocks_read: {
      label: '累计读取数据块',
      format: 'count'
    },
    blocks_hit: {
      label: '累计命中数据块',
      format: 'count'
    },
    temp_files: {
      label: '累计临时文件',
      format: 'count'
    },
    rows_returned: {
      label: '累计返回行数',
      format: 'count'
    },
    rows_fetched: {
      label: '累计抓取行数',
      format: 'count'
    },
    rows_inserted: {
      label: '累计插入行数',
      format: 'count'
    },
    rows_updated: {
      label: '累计更新行数',
      format: 'count'
    },
    rows_deleted: {
      label: '累计删除行数',
      format: 'count'
    },
    conflicts: {
      label: '累计恢复冲突',
      format: 'count'
    },
    block_read_time_ms: {
      label: '累计数据块读取耗时',
      format: 'milliseconds'
    },
    block_write_time_ms: {
      label: '累计数据块写入耗时',
      format: 'milliseconds'
    },
    stats_reset: {
      label: '统计重置时间',
      format: 'date'
    },
    uptime: {
      label: '运行时间',
      format: 'seconds'
    },
    max_connections: {
      label: '实例连接数上限',
      format: 'count'
    },
    shared_buffers_bytes: {
      label: '共享缓冲区',
      format: 'bytes'
    },
    work_mem_bytes: {
      label: '单操作工作内存',
      format: 'bytes'
    },
    maintenance_work_mem_bytes: {
      label: '维护工作内存',
      format: 'bytes'
    },
    effective_cache_bytes: {
      label: '规划器缓存估计',
      format: 'bytes'
    },
    track_io_timing: {
      label: 'I/O 计时已启用',
      format: 'flag'
    },
    wal_level: {
      label: 'WAL 级别',
      format: 'text'
    },
    server_started_at: {
      label: '服务端启动时间',
      format: 'date'
    },
    waiting_locks: {
      label: '等待锁记录',
      format: 'count'
    },
    granted_locks: {
      label: '已授予锁记录',
      format: 'count'
    },
    tables: {
      label: '用户表数量',
      format: 'count'
    },
    estimated_live_rows: {
      label: '估算存活行数',
      format: 'count'
    },
    estimated_dead_rows: {
      label: '估算死元组数',
      format: 'count'
    },
    sequential_scans: {
      label: '累计顺序扫描',
      format: 'count'
    },
    index_scans: {
      label: '累计索引扫描',
      format: 'count'
    },
    autovacuum_count: {
      label: '累计自动清理',
      format: 'count'
    },
    autoanalyze_count: {
      label: '累计自动分析',
      format: 'count'
    }
  },
  roleLabels: {
    primary: '主库',
    standby: '备库'
  },
  notice: '会话状态受账号可见权限限制；数据块读取可能命中操作系统缓存，行数与死元组为估算值。'
} as const satisfies MonitorPanelConfig
