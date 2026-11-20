import { CheckOutlined, CopyOutlined } from '@ant-design/icons'
import { EditorView } from '@codemirror/view'
import CodeMirror from '@uiw/react-codemirror'
import type { ReactCodeMirrorProps } from '@uiw/react-codemirror'
import { theme, Typography } from 'antd'
import { memo, useEffect, useMemo, useState } from 'react'

import ContentCard from '@/components/contentCard'
import { getDatabaseAdapter } from '@/databases'
import { DatabaseEngine } from '@/databases/typings'
import type { DatabaseType } from '@/databases/typings'
import { useTranslation } from '@/hooks/useTranslation'
import type { ThemeMode } from '@/typings/theme'

import { sqlPreviewAppearance, sqlPreviewLayout } from '../../utils/editorAppearance'
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
const copyFeedbackMs = 1500
const firstLineHeight = `calc(${sqlPreviewLayout.lineHeight}em + ${sqlPreviewLayout.paddingBlock * 2}px)`
/** 只读执行文本，复用引擎语言扩展与原生复制反馈。 */
function SQLPreview({ sql, themeMode, databaseType, compact = false, title = 'SQL', panel = false }: Props) {
  const { t } = useTranslation()
  const { token } = theme.useToken()
  const [copyFeedback, setCopyFeedback] = useState<{ sql: string }>()
  const copied = copyFeedback?.sql === sql

  useEffect(() => {
    if (!copyFeedback) return
    const timer = window.setTimeout(() => setCopyFeedback(undefined), copyFeedbackMs)
    return () => window.clearTimeout(timer)
  }, [copyFeedback])

  const copySQL = async () => {
    try {
      if (window.sqlStudioDesktop) {
        if (!(await window.sqlStudioDesktop.writeClipboardText(sql))) return
      } else {
        await navigator.clipboard.writeText(sql)
      }
      setCopyFeedback({ sql })
    } catch {
      // Copying is optional; permission or clipboard failures must not interrupt the preview.
    }
  }
  const redis = databaseType === DatabaseEngine.Redis
  const extensions = useMemo(() => {
    const base = [sqlPreviewAppearance, EditorView.lineWrapping]
    return redis ? base : [...base, getDatabaseAdapter(databaseType).completion({ database: '', table: '', schema: {} })]
  }, [databaseType, redis])
  const copyButton = (
    <ToolbarButton
      size="small"
      icon={copied ? <CheckOutlined style={{ color: token.colorSuccessText }} /> : <CopyOutlined />}
      onClick={copySQL}
      label={t(redis ? '复制命令' : '复制 SQL')}
      hint={copied ? t('已复制') : undefined}
      style={{ flex: 'none' }}
    />
  )
  const editor = (
    <div style={{ flex: 1, minWidth: 0 }}>
      <CodeMirror value={sql} theme={themeMode} extensions={extensions} editable={false} readOnly basicSetup={previewSetup} aria-label={t(redis ? 'Redis 命令' : 'SQL 文本')} />
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
      <div style={{ display: 'flex', alignItems: 'center', flex: 'none', minHeight: firstLineHeight }}>{copyButton}</div>
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
