import type { MonitorPanelConfig } from '@/typings/databaseMonitor'

export const monitorConfig = {
  title: '数据库概览',
  overview: [
    {
      key: 'tables',
      label: '表数量',
      format: 'count'
    },
    {
      key: 'regions',
      label: '主分片数',
      format: 'count'
    },
    {
      key: 'approximate_rows',
      label: '估算行数',
      format: 'count'
    },
    {
      key: 'region_disk_bytes',
      label: '分片磁盘占用',
      format: 'bytes'
    }
  ],
  activity: [
    {
      key: 'region_memtable_bytes',
      label: '分片写入缓冲占用',
      format: 'bytes'
    },
    {
      key: 'region_sst_files',
      label: '分片 SST 文件数',
      format: 'count'
    },
    {
      key: 'region_sst_bytes',
      label: '分片 SST 大小',
      format: 'bytes'
    },
    {
      key: 'region_index_bytes',
      label: '分片索引大小',
      format: 'bytes'
    },
    {
      key: 'region_manifest_bytes',
      label: '分片元数据大小',
      format: 'bytes'
    },
    {
      key: 'region_written_bytes',
      label: '分片打开以来写入',
      format: 'bytes'
    },
    {
      key: 'region_scanned_bytes',
      label: '分片打开以来扫描',
      format: 'bytes'
    },
    {
      key: 'region_query_cpu_ms',
      label: '分片打开以来查询 CPU',
      format: 'milliseconds'
    }
  ],
  charts: [
    {
      key: 'topology',
      title: '表与分片趋势',
      series: [
        {
          key: 'tables',
          label: '表数量',
          format: 'count',
          tone: 'primary'
        },
        {
          key: 'regions',
          label: '主分片数',
          format: 'count',
          tone: 'link'
        }
      ]
    },
    {
      key: 'rows',
      title: '估算行数趋势',
      series: [
        {
          key: 'approximate_rows',
          label: '估算行数',
          format: 'count',
          tone: 'primary'
        }
      ]
    },
    {
      key: 'storage',
      title: '分片存储趋势',
      series: [
        {
          key: 'region_disk_bytes',
          label: '分片磁盘占用',
          format: 'bytes',
          tone: 'primary'
        },
        {
          key: 'region_memtable_bytes',
          label: '分片写入缓冲占用',
          format: 'bytes',
          tone: 'warning'
        }
      ]
    },
    {
      key: 'sst',
      title: 'SST 文件趋势',
      series: [
        {
          key: 'region_sst_files',
          label: '分片 SST 文件数',
          format: 'count',
          tone: 'link'
        }
      ]
    }
  ],
  sectionLabels: {
    catalog: '目录与构建',
    storage: '分片存储',
    region_activity: '分片累计活动',
    statistics: '运行统计'
  },
  fields: {
    tables: {
      label: '表数量',
      format: 'count'
    },
    regions: {
      label: '主分片数',
      format: 'count'
    },
    approximate_rows: {
      label: '估算行数',
      format: 'count'
    },
    region_disk_bytes: {
      label: '分片磁盘占用',
      format: 'bytes'
    },
    region_memtable_bytes: {
      label: '分片写入缓冲占用',
      format: 'bytes'
    },
    region_sst_files: {
      label: '分片 SST 文件数',
      format: 'count'
    },
    region_sst_bytes: {
      label: '分片 SST 大小',
      format: 'bytes'
    },
    region_index_bytes: {
      label: '分片索引大小',
      format: 'bytes'
    },
    region_manifest_bytes: {
      label: '分片元数据大小',
      format: 'bytes'
    },
    region_written_bytes: {
      label: '分片打开以来写入',
      format: 'bytes'
    },
    region_scanned_bytes: {
      label: '分片打开以来扫描',
      format: 'bytes'
    },
    region_query_cpu_ms: {
      label: '分片打开以来查询 CPU',
      format: 'milliseconds'
    },
    build_commit: {
      label: '构建提交',
      format: 'text'
    }
  },
  notice: '分片统计为估算值；分片打开以来的累计值可能因重新打开而重置。'
} as const satisfies MonitorPanelConfig
