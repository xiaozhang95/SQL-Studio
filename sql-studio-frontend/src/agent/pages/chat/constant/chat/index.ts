import type { CSSProperties } from 'react'

export const CHAT = {
  maxQuestionLength: 2000,
  tools: {
    list_connections: '查看可用连接',
    list_databases: '查看数据库',
    use_database: '确定查询目标',
    list_tables: '查看数据表',
    describe_table: '查看字段',
    query_readonly: '执行只读查询'
  } as Readonly<Record<string, string>>,
  resultTitles: {
    list_connections: '可用连接',
    list_databases: '数据库列表',
    use_database: '当前数据库',
    list_tables: '表与视图',
    describe_table: '字段结构',
    query_readonly: '查询结果'
  } as Readonly<Record<string, string>>,
  headerHeight: 56,
  content: {
    width: '100%',
    margin: 0,
    minWidth: 0
  } satisfies CSSProperties
} as const
