import { CodeOutlined, EditOutlined, LoadingOutlined } from '@ant-design/icons'
import { Bubble } from '@ant-design/x'
import { Alert, Button, Divider, Flex, Spin, theme, Tooltip, Typography } from 'antd'
import { Fragment } from 'react'

import type { Entry } from '../../../../typings/chat'
import { chatErrors } from '../../../../utils/chatEvents'
import { readSQL } from '../../../../utils/queryResult'
import { CHAT } from '../../constant/chat'
import { AnswerContent } from '../answerContent'
import { ProcessCard } from '../processCard'
import { QueryResult } from '../queryResult'
import { RoundFooter } from '../roundFooter'

interface Block {
  type: 'message' | 'tools' | 'thinking' | 'footer'
  entries: Entry[]
}
function blocks(entries: Entry[]): Block[] {
  const out: Block[] = []
  let turn: Entry[] = []
  function finishTurn() {
    if (turn.length) out.push({ type: 'footer', entries: turn })
    turn = []
  }
  for (const e of entries) {
    if (e.role === 'user') finishTurn()
    turn.push(e)
    if (e.role === 'error') continue
    const last = out[out.length - 1]
    if (e.role === 'tool' && last?.type === 'tools') last.entries.push(e)
    else
      out.push({
        type: e.role === 'tool' ? 'tools' : e.role === 'thinking' ? 'thinking' : 'message',
        entries: [e]
      })
  }
  finishTurn()
  return out
}
interface Props {
  waiting: boolean
  entries: Entry[]
  locked: boolean
  busy: boolean
  status: string
  expanded: string[]
  onExpanded: (keys: string[]) => void
  onEdit: (text: string) => void
}
export function TurnContent({ entries, busy, waiting, locked, status, expanded, onExpanded, onEdit }: Props) {
  const { token } = theme.useToken()
  function change(id: string, open: boolean) {
    onExpanded(open ? [...expanded.filter((k) => k !== id), id] : expanded.filter((k) => k !== id))
  }
  const sections = blocks(entries)
  return (
    <Flex vertical gap={CHAT.spacing.block} style={{ width: '100%', minWidth: 0, paddingBottom: token.padding }}>
      {sections.map((block) => {
        const first = block.entries[0]
        if (block.type === 'footer')
          return (
            <Fragment key={`errors-${first.id}`}>
              {chatErrors(block.entries).map((error) => (
                <Alert key={error} type="error" showIcon title={error} />
              ))}
              {block.entries
                .filter((entry) => entry.stopped)
                .map((entry) => (
                  <Alert key={entry.id} type="info" showIcon title={entry.text} />
                ))}
              <RoundFooter entries={block.entries} ongoing={busy && block === sections[sections.length - 1]} waiting={waiting} />
            </Fragment>
          )
        if (block.type === 'thinking')
          return (
            <ProcessCard
              key={first.id}
              expanded={expanded.includes(`thinking-${first.id}`)}
              onExpand={(open) => change(`thinking-${first.id}`, open)}
              title={first.streaming ? 'DeepSeek 正在思考…' : first.incomplete ? '思考过程（未完成）' : 'DeepSeek 思考过程'}
            >
              <Typography.Paragraph
                style={{
                  whiteSpace: 'pre-wrap',
                  overflowWrap: 'anywhere',
                  margin: 0
                }}
              >
                {first.text}
              </Typography.Paragraph>
            </ProcessCard>
          )
        if (block.type === 'tools')
          return (
            <ProcessCard
              key={first.id}
              title={`执行过程 · ${block.entries.length} 项操作`}
              icon={<CodeOutlined style={{ color: token.colorTextSecondary, fontSize: token.fontSize, width: token.fontSize, height: token.fontSize }} />}
              expanded={expanded.includes(`tools-${first.id}`)}
              onExpand={(open) => change(`tools-${first.id}`, open)}
            >
              <Flex vertical gap={CHAT.spacing.block} style={{ width: '100%', minWidth: 0 }}>
                {block.entries.map((e, index) => (
                  <Flex key={e.id} vertical gap={CHAT.spacing.block} style={{ minWidth: 0 }}>
                    <Flex vertical gap={CHAT.spacing.detail} style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                      <Typography.Text type="secondary">
                        {index + 1}. {CHAT.tools[e.tool ?? ''] ?? '处理请求'} · <Typography.Text copyable={{ text: e.tool ?? '' }}>{e.tool ?? '未知工具'}</Typography.Text>
                      </Typography.Text>
                      <div>
                        <Typography.Text type="secondary">对应 Go API（当前为进程内调用）：</Typography.Text>
                        <Typography.Text copyable={CHAT.toolEndpoints[e.tool ?? ''] ? { text: CHAT.toolEndpoints[e.tool ?? ''] } : false}>
                          {CHAT.toolEndpoints[e.tool ?? ''] ?? '切换会话数据库上下文，无独立 HTTP 接口'}
                        </Typography.Text>
                      </div>
                      {e.text.trim() && !/^\{\s*\}$/.test(e.text.trim()) && (
                        <Flex vertical gap={CHAT.spacing.detail}>
                          <Typography.Text type="secondary">请求参数</Typography.Text>
                          <Typography.Paragraph
                            copyable={{ text: e.text }}
                            style={{
                              whiteSpace: 'pre-wrap',
                              overflowWrap: 'anywhere',
                              margin: 0
                            }}
                          >
                            {e.text}
                          </Typography.Paragraph>
                        </Flex>
                      )}
                    </Flex>
                    {e.result !== undefined && <QueryResult value={e.result} sql={readSQL(e.text)} title={CHAT.resultTitles[e.tool ?? ''] ?? '执行结果'} tool={e.tool} showHeader={false} />}
                  </Flex>
                ))}
              </Flex>
            </ProcessCard>
          )
        return block.entries.map((e) => {
          const user = e.role === 'user'
          return (
            <Flex key={e.id} vertical gap={CHAT.spacing.detail} style={{ width: '100%', minWidth: 0 }}>
              <Bubble
                placement={user ? 'end' : 'start'}
                variant={user ? 'filled' : 'borderless'}
                styles={{
                  root: { width: user ? undefined : '100%' },
                  body: { width: user ? undefined : '100%', maxWidth: '100%', minWidth: 0 },
                  content: { padding: user ? token.paddingSM : 0, maxWidth: '100%', width: user ? undefined : '100%' }
                }}
                content={
                  !user ? (
                    <AnswerContent text={e.text} />
                  ) : (
                    <Typography.Paragraph
                      style={{
                        whiteSpace: 'pre-wrap',
                        overflowWrap: 'anywhere',
                        margin: 0,
                        maxWidth: '100%'
                      }}
                    >
                      {e.text}
                      {e.incomplete && <Typography.Text type="secondary">（未完成）</Typography.Text>}
                    </Typography.Paragraph>
                  )
                }
              />
              {user && (
                <Flex justify="end" align="center" gap={CHAT.spacing.detail} wrap>
                  {e.createdAt && <Typography.Text type="secondary">{new Date(e.createdAt).toLocaleString('zh-CN', { hour12: false })}</Typography.Text>}
                  <Tooltip title="编辑问题">
                    <Button type="text" size="small" aria-label="编辑问题" disabled={locked} icon={<EditOutlined />} onClick={() => onEdit(e.text)} />
                  </Tooltip>
                  <Typography.Text copyable={{ text: e.text, tooltips: ['复制问题', '已复制'] }} />
                </Flex>
              )}
              {user && <Divider style={{ margin: 0, borderBlockStart: '1px solid var(--border)' }} />}
            </Flex>
          )
        })
      })}
      {busy && !waiting && (
        <Flex align="center" gap={CHAT.spacing.detail}>
          <Spin indicator={<LoadingOutlined spin />} size="small" />
          <Typography.Text type="secondary">{status || '正在思考…'}</Typography.Text>
        </Flex>
      )}
    </Flex>
  )
}
