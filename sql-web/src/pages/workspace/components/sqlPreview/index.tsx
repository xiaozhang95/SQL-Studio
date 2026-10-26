import { CopyOutlined } from '@ant-design/icons'
import { EditorView } from '@codemirror/view'
import CodeMirror from '@uiw/react-codemirror'
import { App, Button, Card, Typography } from 'antd'
import { useMemo } from 'react'

import { getDatabaseAdapter } from '@/databases'
import type { DatabaseType } from '@/databases/typings'
import type { ThemeMode } from '@/typings/theme'

type Props = { sql: string; themeMode: ThemeMode; databaseType?: DatabaseType; compact?: boolean; maxHeight?: string; singleLine?: boolean; title?: string; panel?: boolean; height?: string }
/** 只读执行文本，复用引擎语言扩展与原生复制反馈。 */
export default function SQLPreview({ sql, themeMode, databaseType, compact = false, maxHeight = '160px', singleLine = false, title = 'SQL', panel = false, height }: Props) {
  const { message } = App.useApp()
  const copySQL = async () => {
    try {
      await navigator.clipboard.writeText(sql)
      message.success('已复制')
    } catch {
      message.error('复制失败，请选中文本后手动复制')
    }
  }
  const extensions = useMemo(() => [getDatabaseAdapter(databaseType).completion({ database: '', table: '', schema: {} }), ...(singleLine ? [] : [EditorView.lineWrapping])], [databaseType, singleLine])
  const copyButton = <Button size="small" icon={<CopyOutlined />} onClick={copySQL} aria-label="复制" title="复制" style={{ flex: 'none' }}></Button>
  const editor = (
    <CodeMirror
      value={singleLine ? sql.split(/\r?\n/, 1)[0] : sql}
      theme={themeMode}
      extensions={extensions}
      editable={false}
      readOnly
      height={height}
      maxHeight={maxHeight}
      style={{ flex: 1, minWidth: 0 }}
      basicSetup={{ lineNumbers: false, foldGutter: false, highlightActiveLine: false, highlightActiveLineGutter: false, autocompletion: false }}
      aria-label="SQL 文本"
    />
  )
  if (panel)
    return (
      <Card size="small" title={title} extra={copyButton} styles={{ body: { padding: 0 } }} style={{ minWidth: 0 }}>
        <div className="output-sql-preview">{editor}</div>
      </Card>
    )
  return compact ? (
    <div className={`output-sql-preview${singleLine ? ' is-single-line' : ''}`} title={singleLine ? sql : undefined} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      {editor}
      {copyButton}
    </div>
  ) : (
    <div className="output-sql-preview">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <Typography.Text>{title}</Typography.Text>
        {copyButton}
      </div>
      {editor}
    </div>
  )
}
