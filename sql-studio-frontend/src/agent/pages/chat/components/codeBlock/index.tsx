import { ExportOutlined } from '@ant-design/icons'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { python } from '@codemirror/lang-python'
import { sql } from '@codemirror/lang-sql'
import { EditorView } from '@codemirror/view'
import CodeMirror from '@uiw/react-codemirror'
import { Button, Space, theme, Tooltip, Typography } from 'antd'
import { useMemo } from 'react'

import ContentCard from '@/components/contentCard'
import { useNavigationLock } from '@/contexts/navigationLock'
import { useTranslation } from '@/hooks/useTranslation'
import { requestOpenQuery } from '@/services/openQuery'

import { APPEARANCE } from '../../../../constant/appearance'

function formatJsonText(text: string) {
  try {
    JSON.parse(text)
  } catch {
    return text
  }

  let depth = 0
  const nextLine = () => '\n' + '  '.repeat(depth)
  // Reindent only whitespace outside strings so the original parameter values stay intact.
  return text.replace(/"(?:[^"\\]|\\.)*"|\{\s*\}|\[\s*\]|[{}[\],:]|\s+/g, (token) => {
    switch (token) {
      case '{':
      case '[':
        depth++
        return token + nextLine()
      case '}':
      case ']':
        depth--
        return nextLine() + token
      case ',':
        return token + nextLine()
      case ':':
        return ': '
      default:
        return token.startsWith('"') ? token : token.replace(/\s/g, '')
    }
  })
}

export function CodeBlock({ text, language, title, formatJson = false, allowOpen = false }: { text: string; language: string; title?: string; formatJson?: boolean; allowOpen?: boolean }) {
  const { t } = useTranslation()
  const { locked } = useNavigationLock()

  const { token } = theme.useToken()
  const sqlLanguage = ['sql', 'mysql', 'postgres', 'postgresql'].includes(language)
  const displayText = useMemo(() => (formatJson && language === 'json' ? formatJsonText(text) : text), [formatJson, language, text])
  const extensions = useMemo(() => {
    const lang = sqlLanguage
      ? sql()
      : ['json', 'jsonc'].includes(language)
        ? json()
        : ['js', 'javascript', 'jsx', 'ts', 'typescript', 'tsx'].includes(language)
          ? javascript({ typescript: ['ts', 'typescript', 'tsx'].includes(language), jsx: ['jsx', 'tsx'].includes(language) })
          : language === 'python' || language === 'py'
            ? python()
            : []
    return [
      lang,
      EditorView.lineWrapping,
      EditorView.theme({
        '&.cm-editor': {
          backgroundColor: token.colorBgContainer,
          color: token.colorText,
          fontSize: 'var(--ant-font-size)',
          fontFamily: 'inherit'
        },
        '&.cm-focused': { outline: 'none' },
        '.cm-scroller': { overflow: 'auto', fontFamily: 'inherit', fontSize: 'var(--ant-font-size)', lineHeight: '1.72' },
        '.cm-content': { padding: '12px 14px', fontFamily: 'inherit' }
      })
    ]
  }, [sqlLanguage, language, token.colorBgContainer, token.colorText])
  return (
    <ContentCard
      code
      title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{title ?? (sqlLanguage ? 'SQL' : language || t('代码'))}</span>}
      extra={
        <Space size={2}>
          <Typography.Text copyable={{ text, tooltips: [t('复制代码'), t('已复制')] }} />
          {sqlLanguage && allowOpen && (
            <Tooltip title={t('在查询页打开')}>
              <Button type="text" aria-label={t('在查询页打开')} icon={<ExportOutlined />} disabled={locked} onClick={() => requestOpenQuery(text)} />
            </Tooltip>
          )}
        </Space>
      }
    >
      <CodeMirror
        aria-label={t('代码内容')}
        value={displayText}
        extensions={extensions}
        editable={false}
        readOnly
        maxHeight={`${APPEARANCE.resultPreviewHeight}px`}
        theme={token.colorBgBase === '#000' ? 'dark' : 'light'}
        basicSetup={{ lineNumbers: false, foldGutter: false, highlightActiveLine: false, highlightActiveLineGutter: false, autocompletion: false }}
      />
    </ContentCard>
  )
}
