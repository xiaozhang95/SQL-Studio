import type { CSSProperties } from 'react'

const conversationMaxWidth = 960
const transcriptInset = 32
const loadingMinDuration = 1000

export const CHAT = {
  composerResize: { minimumHeight: 160, compactMinimumHeight: 120, maximumHeight: 560, reservedHeight: 200, keyboardStep: 24, handleHeight: 8 },
  roundSwitch: { windowSize: 5, estimatedHeight: 520, loadingMinDuration, edgeTolerance: 2 },
  iconButton: { type: 'default', shape: 'circle', size: 'small' },
  resultIndexWidth: 56,
  maxQuestionBytes: 256 * 1024,
  maxTitleLength: 80,
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
