import { CopyOutlined } from '@ant-design/icons'
import { EditorView } from '@codemirror/view'
import CodeMirror from '@uiw/react-codemirror'
import { App, Button, Typography } from 'antd'
import { useMemo } from 'react'

import { getDatabaseAdapter } from '@/databases'
import type { DatabaseType } from '@/databases/typings'
import type { ThemeMode } from '@/typings/theme'

type Props = { sql: string; themeMode: ThemeMode; databaseType?: DatabaseType; compact?: boolean; maxHeight?: string; singleLine?: boolean }
/** 只读执行文本，复用引擎语言扩展与原生复制反馈。 */
export default function SQLPreview({ sql, themeMode, databaseType, compact = false, maxHeight = '160px', singleLine = false }: Props) {
  const { message } = App.useApp()
  const copySQL = async () => {
    try {
      await navigator.clipboard.writeText(sql)
      message.success('SQL 已复制')
    } catch {
      message.error('复制失败，请选中 SQL 后手动复制')
    }
  }
  const extensions = useMemo(() => [getDatabaseAdapter(databaseType).completion({ database: '', table: '', schema: {} }), ...(singleLine ? [] : [EditorView.lineWrapping])], [databaseType, singleLine])
  const copyButton = (
    <Button size="small" icon={<CopyOutlined />} onClick={copySQL} aria-label="复制 SQL" title="复制 SQL" style={{ flex: 'none' }}>
      {compact ? undefined : '复制 SQL'}
    </Button>
  )
  const editor = (
    <CodeMirror
      value={singleLine ? sql.split(/\r?\n/, 1)[0] : sql}
      theme={themeMode}
      extensions={extensions}
      editable={false}
      readOnly
      maxHeight={maxHeight}
      style={{ flex: 1, minWidth: 0 }}
      basicSetup={{ lineNumbers: false, foldGutter: false, highlightActiveLine: false, highlightActiveLineGutter: false, autocompletion: false }}
      aria-label="SQL 文本"
    />
  )
  return compact ? (
    <div className={`output-sql-preview${singleLine ? ' is-single-line' : ''}`} title={singleLine ? sql : undefined} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      {editor}
      {copyButton}
    </div>
  ) : (
    <div className="output-sql-preview">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <Typography.Text>SQL</Typography.Text>
        {copyButton}
      </div>
      {editor}
    </div>
  )
}
