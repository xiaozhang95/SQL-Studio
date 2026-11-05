import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { python } from '@codemirror/lang-python'
import { sql } from '@codemirror/lang-sql'
import { EditorView } from '@codemirror/view'
import CodeMirror from '@uiw/react-codemirror'
import { Card, theme, Typography } from 'antd'
import { useMemo } from 'react'

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

export function CodeBlock({ text, language, title, formatJson = false }: { text: string; language: string; title?: string; formatJson?: boolean }) {
  const { token } = theme.useToken()
  const displayText = useMemo(() => (formatJson && language === 'json' ? formatJsonText(text) : text), [formatJson, language, text])
  const extensions = useMemo(() => {
    const lang = ['sql', 'mysql', 'postgres', 'postgresql'].includes(language)
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
        '&.cm-editor': { backgroundColor: token.colorBgContainer, color: token.colorText, fontSize: `${token.fontSize}px`, fontFamily: token.fontFamily },
        '&.cm-focused': { outline: 'none' },
        '.cm-scroller': { overflow: 'auto', fontFamily: token.fontFamily, fontSize: `${token.fontSize}px`, lineHeight: String(token.lineHeight) },
        '.cm-content': { padding: `${token.paddingSM}px`, fontFamily: token.fontFamily }
      })
    ]
  }, [language, token.colorBgContainer, token.colorText, token.fontSize, token.fontFamily, token.lineHeight, token.paddingSM])
  return (
    <Card
      size="small"
      className="content-frame code-panel"
      title={title ?? (language || '代码')}
      extra={<Typography.Text copyable={{ text, tooltips: ['复制代码', '已复制'] }} />}
      styles={{ header: { marginBottom: 0, borderBottomColor: 'var(--border)' } }}
    >
      <CodeMirror
        aria-label="代码内容"
        value={displayText}
        extensions={extensions}
        editable={false}
        readOnly
        maxHeight={`${APPEARANCE.resultPreviewHeight}px`}
        theme={token.colorBgBase === '#000' ? 'dark' : 'light'}
        basicSetup={{ lineNumbers: false, foldGutter: false, highlightActiveLine: false, highlightActiveLineGutter: false, autocompletion: false }}
      />
    </Card>
  )
}
