import type { CSSProperties } from 'react'

const conversationMaxWidth = 960
const transcriptInset = 32

export const CHAT = {
  historyBatchSize: 8,
  historyLoadingDelay: 80,
  historyBoundaryHeight: 48,
  maxQuestionLength: 2000,
  maxTitleLength: 80,
  toolEndpoints: {
    execute_write: 'POST /api/connections/:id/query',
    list_connections: 'GET /api/connections',
    list_databases: 'GET /api/connections/:id/databases',
    list_tables: 'GET /api/connections/:id/tables',
    describe_table: 'GET /api/connections/:id/columns',
    query_readonly: 'POST /api/connections/:id/query'
  } as Readonly<Record<string, string>>,
  tools: {
    execute_write: '新增或修改数据',
    list_connections: '查看可用连接',
    list_databases: '查看数据库',
    use_database: '确定查询目标',
    list_tables: '查看数据表',
    describe_table: '查看字段',
    query_readonly: '执行只读查询'
  } as Readonly<Record<string, string>>,
  resultTitles: {
    execute_write: '写入结果',
    list_connections: '可用连接',
    list_databases: '数据库列表',
    use_database: '当前数据库',
    list_tables: '表与视图',
    describe_table: '字段结构',
    query_readonly: '查询结果'
  } as Readonly<Record<string, string>>,
  headerHeight: 56,
  transcriptInset,
  conversationMaxWidth,
  modelSelectorWidth: 192,
  modelMenuIconSize: 18,
  modelTriggerIconSize: 20,
  modeConfirmationWidth: 720,
  spacing: { block: 'middle', detail: 'small' },
  composerRows: { minRows: 4, maxRows: 10 },
  content: {
    width: `calc(100% - ${transcriptInset * 2}px)`,
    maxWidth: conversationMaxWidth,
    marginInline: 'auto',
    minWidth: 0
  } satisfies CSSProperties
} as const
