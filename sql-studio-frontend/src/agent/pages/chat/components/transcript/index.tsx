import { EyeOutlined, LoadingOutlined } from '@ant-design/icons'
import { Bubble } from '@ant-design/x'
import { Button, Flex, Space, Spin, theme, Typography } from 'antd'

import type { Entry } from '../../../../typings/chat'
import { readSQL } from '../../../../utils/queryResult'
import { CHAT } from '../../constant/chat'
import { useTranscriptScroll } from '../../hooks/transcriptScroll'
import { ProcessCard } from '../processCard'
import { QueryResult } from '../queryResult'

interface Block {
  type: 'message' | 'tools' | 'thinking'
  entries: Entry[]
}
function blocks(entries: Entry[]): Block[] {
  const out: Block[] = []
  for (const e of entries) {
    const last = out[out.length - 1]
    if (e.role === 'tool' && last?.type === 'tools') last.entries.push(e)
    else
      out.push({
        type: e.role === 'tool' ? 'tools' : e.role === 'thinking' ? 'thinking' : 'message',
        entries: [e]
      })
  }
  return out
}
interface Props {
  entries: Entry[]
  busy: boolean
  status: string
  expanded: string[]
  onExpanded: (keys: string[]) => void
}
export function Transcript({ entries, busy, status, expanded, onExpanded }: Props) {
  const end = useTranscriptScroll(entries, busy)
  const { token } = theme.useToken()
  function change(id: string, open: boolean) {
    onExpanded(open ? [...expanded.filter((k) => k !== id), id] : expanded.filter((k) => k !== id))
  }
  const sections = blocks(entries)
  const hiddenCount = sections.filter((block) => block.type !== 'message' && expanded.includes(`hidden-${block.type}-${block.entries[0].id}`)).length
  function hide(id: string) {
    onExpanded([...expanded.filter((k) => k !== `hidden-${id}`), `hidden-${id}`])
  }
  return (
    <Flex vertical gap="middle" style={{ width: '100%', paddingBottom: token.padding }}>
      {hiddenCount > 0 && (
        <Flex align="center" gap="small">
          <Typography.Text type="secondary">已隐藏 {hiddenCount} 项过程</Typography.Text>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => onExpanded(expanded.filter((k) => !k.startsWith('hidden-')))}>
            显示过程
          </Button>
        </Flex>
      )}
      {sections.map((block) => {
        const first = block.entries[0]
        if (block.type === 'thinking')
          return expanded.includes(`hidden-thinking-${first.id}`) ? null : (
            <ProcessCard
              key={first.id}
              name="思考过程"
              expanded={expanded.includes(`thinking-${first.id}`)}
              onExpand={(open) => change(`thinking-${first.id}`, open)}
              onHide={() => hide(`thinking-${first.id}`)}
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
            <Flex key={first.id} vertical gap="small" style={{ minWidth: 0 }}>
              {!expanded.includes(`hidden-tools-${first.id}`) && (
                <ProcessCard
                  title={`执行过程 · ${block.entries.length} 项操作`}
                  name="执行过程"
                  expanded={expanded.includes(`tools-${first.id}`)}
                  onExpand={(open) => change(`tools-${first.id}`, open)}
                  onHide={() => hide(`tools-${first.id}`)}
                >
                  <Space orientation="vertical" style={{ width: '100%' }}>
                    {block.entries.map((e, index) => (
                      <div key={e.id}>
                        <Typography.Text type="secondary">
                          {index + 1}. {CHAT.tools[e.tool ?? ''] ?? '处理请求'}
                        </Typography.Text>
                        <Typography.Paragraph
                          style={{
                            whiteSpace: 'pre-wrap',
                            overflowWrap: 'anywhere',
                            margin: 0
                          }}
                        >
                          {e.text}
                        </Typography.Paragraph>
                      </div>
                    ))}
                  </Space>
                </ProcessCard>
              )}
              {block.entries
                .filter((e) => e.result !== undefined)
                .map((e) => (
                  <QueryResult key={e.id} value={e.result} sql={readSQL(e.text)} title={CHAT.resultTitles[e.tool ?? ''] ?? '执行结果'} tool={e.tool} />
                ))}
            </Flex>
          )
        return block.entries.map((e) => {
          const user = e.role === 'user'
          return (
            <Bubble
              key={e.id}
              placement={user ? 'end' : 'start'}
              variant={user ? 'filled' : 'borderless'}
              styles={{ content: { padding: user ? token.paddingSM : 0, maxWidth: '100%' } }}
              content={
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
              }
            />
          )
        })
      })}
      {busy && (
        <Flex align="center" gap="small">
          <Spin indicator={<LoadingOutlined spin />} size="small" />
          <Typography.Text type="secondary">{status || '正在思考…'}</Typography.Text>
        </Flex>
      )}
      <div ref={end} />
    </Flex>
  )
}
