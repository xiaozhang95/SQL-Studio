import MonitorPanel from '@/components/monitorPanel'
import type { DatabaseMonitorPanelProps } from '@/databases/typings'
import type { MonitorPanelConfig } from '@/typings/databaseMonitor'

const tables = { key: 'tables', label: '表数量', format: 'count' } as const
const views = { key: 'views', label: '视图数量', format: 'count' } as const
const indexes = { key: 'indexes', label: '索引数量', format: 'count' } as const
const invalid = { key: 'invalid_objects', label: '无效对象', format: 'count' } as const
const sessions = { key: 'sessions', label: '用户会话', format: 'count' } as const
const active = { key: 'active_sessions', label: '活跃会话', format: 'count' } as const
const config = {
  title: '数据库概览',
  overview: [tables, views, indexes, invalid],
  activity: [sessions, active],
  charts: [
    {
      key: 'catalog',
      title: '对象数量趋势',
      series: [
        { ...tables, tone: 'primary' },
        { ...views, tone: 'link' },
        { ...invalid, tone: 'warning' }
      ]
    },
    {
      key: 'sessions',
      title: '会话趋势',
      series: [
        { ...sessions, tone: 'primary' },
        { ...active, tone: 'warning' }
      ]
    }
  ],
  sectionLabels: { instance: '实例信息', catalog: 'Schema 对象', connections: '用户会话' },
  fields: {
    tables,
    views,
    indexes,
    invalid_objects: invalid,
    sessions,
    active_sessions: active,
    database_name: { label: '数据库名称', format: 'text' },
    instance_name: { label: '实例名称', format: 'text' },
    container_name: { label: '容器名称', format: 'text' },
    session_user: { label: '登录用户', format: 'text' }
  },
  notice: '对象数量按登录用户统计。会话数量按当前 Oracle 容器统计。'
} as const satisfies MonitorPanelConfig

export default function OracleMonitor(props: DatabaseMonitorPanelProps) {
  return <MonitorPanel {...props} config={config} />
}
