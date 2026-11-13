import { CopyOutlined } from '@ant-design/icons'
import { EditorView } from '@codemirror/view'
import CodeMirror from '@uiw/react-codemirror'
import type { ReactCodeMirrorProps } from '@uiw/react-codemirror'
import { App, Typography } from 'antd'
import { memo, useMemo, useState } from 'react'

import ContentCard from '@/components/contentCard'
import ErrorNotice from '@/components/errorNotice'
import { getDatabaseAdapter } from '@/databases'
import type { DatabaseType } from '@/databases/typings'
import type { ThemeMode } from '@/typings/theme'

import { sqlPreviewAppearance } from '../../utils/editorAppearance'
import ToolbarButton from '../toolbarButton'

type Props = {
  sql: string
  themeMode: ThemeMode
  databaseType?: DatabaseType
  compact?: boolean
  title?: string
  panel?: boolean
}
const previewSetup = { lineNumbers: false, foldGutter: false, highlightActiveLine: false, highlightActiveLineGutter: false, autocompletion: false } satisfies ReactCodeMirrorProps['basicSetup']
/** 只读执行文本，复用引擎语言扩展与原生复制反馈。 */
function SQLPreview({ sql, themeMode, databaseType, compact = false, title = 'SQL', panel = false }: Props) {
  const { message } = App.useApp()
  const [copyError, setCopyError] = useState('')
  const copySQL = async () => {
    setCopyError('')
    try {
      await navigator.clipboard.writeText(sql)
      message.success('已复制')
    } catch {
      setCopyError('复制失败，请选中文本后手动复制')
    }
  }
  const extensions = useMemo(() => [sqlPreviewAppearance, getDatabaseAdapter(databaseType).completion({ database: '', table: '', schema: {} }), EditorView.lineWrapping], [databaseType])
  const copyButton = <ToolbarButton size="small" icon={<CopyOutlined />} onClick={copySQL} label="复制 SQL" style={{ flex: 'none' }} />
  const editor = (
    <div style={{ flex: 1, minWidth: 0 }}>
      <ErrorNotice error={copyError} onClose={() => setCopyError('')} />
      <CodeMirror value={sql} theme={themeMode} extensions={extensions} editable={false} readOnly basicSetup={previewSetup} aria-label="SQL 文本" />
    </div>
  )
  if (panel)
    return (
      <ContentCard code title={title} extra={copyButton}>
        <div className="output-sql-preview" style={{ minWidth: 0 }}>
          {editor}
        </div>
      </ContentCard>
    )
  return compact ? (
    <div className="output-sql-preview" style={{ minWidth: 0, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      {copyButton}
      {editor}
    </div>
  ) : (
    <div className="output-sql-preview" style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <Typography.Text>{title}</Typography.Text>
        {copyButton}
      </div>
      {editor}
    </div>
  )
}
export default memo(SQLPreview)
