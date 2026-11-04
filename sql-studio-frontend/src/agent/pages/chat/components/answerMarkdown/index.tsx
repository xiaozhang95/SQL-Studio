import { Divider, Flex, theme, Typography } from 'antd'
import { Lexer } from 'marked'
import type { MarkedToken, Token } from 'marked'
import { Fragment, useMemo } from 'react'
import type { ReactNode } from 'react'

import { CHAT } from '../../constant/chat'
import { CodeBlock } from '../codeBlock'
import { QueryResult } from '../queryResult'

const supportedTypes: ReadonlySet<string> = new Set([
  'blockquote',
  'br',
  'code',
  'codespan',
  'def',
  'del',
  'em',
  'escape',
  'heading',
  'hr',
  'html',
  'image',
  'link',
  'list',
  'list_item',
  'paragraph',
  'space',
  'strong',
  'table',
  'text'
])

function supportedToken(token: Token): token is MarkedToken {
  return supportedTypes.has(token.type)
}

function safeLink(href: string): string | undefined {
  try {
    const url = new URL(href)
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.href : undefined
  } catch {
    return undefined
  }
}

/** Render Markdown as React elements; model text never becomes executable HTML. */
export function AnswerMarkdown({ text }: { text: string }) {
  const { token: themeToken } = theme.useToken()
  const tokens = useMemo(() => new Lexer({ gfm: true }).lex(text), [text])
  const paragraphStyle = { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', margin: 0 } as const

  function nodes(items: readonly Token[]): ReactNode {
    return items.map((item, index) => <Fragment key={index}>{render(item)}</Fragment>)
  }
  function render(token: Token): ReactNode {
    if (!supportedToken(token)) return token.raw
    switch (token.type) {
      case 'space':
      case 'def':
        return null
      case 'paragraph':
        return <Typography.Paragraph style={paragraphStyle}>{nodes(token.tokens)}</Typography.Paragraph>
      case 'heading':
        return (
          <div role="heading" aria-level={token.depth}>
            <Typography.Text strong>{nodes(token.tokens)}</Typography.Text>
          </div>
        )
      case 'strong':
        return <Typography.Text strong>{nodes(token.tokens)}</Typography.Text>
      case 'em':
        return <em>{nodes(token.tokens)}</em>
      case 'del':
        return <Typography.Text delete>{nodes(token.tokens)}</Typography.Text>
      case 'codespan':
        return <Typography.Text code>{token.text}</Typography.Text>
      case 'br':
        return <br />
      case 'link': {
        const href = safeLink(token.href)
        return href ? (
          <Typography.Link href={href} title={token.title ?? undefined} target="_blank" rel="noopener noreferrer">
            {nodes(token.tokens)}
          </Typography.Link>
        ) : (
          nodes(token.tokens)
        )
      }
      case 'image':
      case 'html':
      case 'escape':
        return token.text
      case 'text':
        return token.tokens ? nodes(token.tokens) : token.text
      case 'code':
        return <CodeBlock text={token.text} language={token.lang ?? ''} />
      case 'hr':
        return <Divider style={{ margin: 0 }} />
      case 'blockquote':
        return (
          <blockquote style={{ margin: 0, paddingInlineStart: themeToken.padding, borderInlineStart: `1px solid ${themeToken.colorBorder}` }}>
            <Flex vertical gap={CHAT.spacing.detail}>
              {nodes(token.tokens)}
            </Flex>
          </blockquote>
        )
      case 'list': {
        const children = token.items.map((item, index) => (
          <li key={index}>
            {item.task ? (item.checked ? '☑ ' : '☐ ') : null}
            {nodes(item.tokens)}
          </li>
        ))
        const style = { margin: 0, paddingInlineStart: themeToken.paddingLG }
        return token.ordered ? (
          <ol start={typeof token.start === 'number' ? token.start : undefined} style={style}>
            {children}
          </ol>
        ) : (
          <ul style={style}>{children}</ul>
        )
      }
      case 'list_item':
        return nodes(token.tokens)
      case 'table':
        return <QueryResult showHeader={false} value={{ columns: token.header.map((cell) => ({ name: cell.text, type: 'text' })), rows: token.rows.map((row) => row.map((cell) => cell.text)) }} />
    }
  }

  return (
    <Flex vertical gap={CHAT.spacing.block} style={{ width: '100%', minWidth: 0, overflowWrap: 'anywhere' }}>
      {nodes(tokens)}
    </Flex>
  )
}
