import { CodeOutlined, EditOutlined, LoadingOutlined } from '@ant-design/icons'
import { Bubble } from '@ant-design/x'
import { Alert, Button, Divider, Flex, Tag, theme, Tooltip, Typography } from 'antd'
import { Fragment, useMemo } from 'react'
import type { ReactNode } from 'react'

import StudioIcon from '@/components/studioIcon'
import { useTranslation } from '@/hooks/useTranslation'

import type { Entry } from '../../../../typings/chat'
import { readSQL } from '../../../../utils/queryResult'
import { CHAT } from '../../constant/chat'
import { AnswerContent } from '../answerContent'
import { CodeBlock } from '../codeBlock'
import { DeepSeekLogo } from '../deepseekLogo'
import { ProcessCard } from '../processCard'
import { QueryResult } from '../queryResult'
import { RoundFooter } from '../roundFooter'

interface Block {
  type: 'message' | 'process' | 'footer'
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
    const process = e.role === 'tool' || e.role === 'thinking'
    if (process && last?.type === 'process') last.entries.push(e)
    else
      out.push({
        type: process ? 'process' : 'message',
        entries: [e]
      })
  }
  finishTurn()
  return out
}
function ProcessDetails({ entries }: { entries: Entry[] }) {
  const { t } = useTranslation()

  const steps = useMemo(() => {
    let toolNumber = 0
    return entries.map((e) => {
      if (e.role === 'thinking')
        return (
          <Flex key={e.id} vertical gap={CHAT.spacing.detail} style={{ minWidth: 0 }}>
            <Typography.Text type="secondary">{e.streaming ? t('DeepSeek 正在思考…') : e.incomplete ? t('思考过程（未完成）') : t('思考过程')}</Typography.Text>
            <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', margin: 0 }}>{e.text}</Typography.Paragraph>
          </Flex>
        )
      toolNumber++
      return (
        <Flex key={e.id} vertical gap={CHAT.spacing.block} style={{ minWidth: 0 }}>
          <Flex vertical gap={CHAT.spacing.detail} style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
            <Typography.Text type="secondary">{t('执行过程')}</Typography.Text>
            <Typography.Text type="secondary">
              {toolNumber}. {t(CHAT.tools[e.tool ?? ''] ?? '处理请求')} · <Typography.Text copyable={{ text: e.tool ?? '' }}>{e.tool ?? t('未知工具')}</Typography.Text>
            </Typography.Text>
            <Typography.Text type="secondary">{t('通过 Go 业务模块在进程内调用')}</Typography.Text>
            {e.text.trim() && !/^\{\s*\}$/.test(e.text.trim()) && <CodeBlock text={e.text} language="json" title={t('请求参数')} formatJson />}
          </Flex>
          {e.result !== undefined && <QueryResult value={e.result} sql={readSQL(e.text)} title={t(CHAT.resultTitles[e.tool ?? ''] ?? '执行结果')} tool={e.tool} showHeader={false} />}
        </Flex>
      )
    })
  }, [entries, t])

  return (
    <Flex vertical gap={CHAT.spacing.block} style={{ minWidth: 0 }}>
      {steps.map((step, index) => (
        <Fragment key={entries[index].id}>
          {index > 0 && <Divider style={{ margin: 0 }} />}
          {step}
        </Fragment>
      ))}
    </Flex>
  )
}

interface Props {
  waiting: boolean
  entries: Entry[]
  locked: boolean
  busy: boolean
  status: string
  assistantModel?: string
  expanded: string[]
  onExpanded: (keys: string[]) => void
  onEdit: (text: string) => void
}

function AssistantHead({ model }: { model?: string }) {
  const { token } = theme.useToken()
  return (
    <Flex align="center" gap={8} style={{ marginBottom: token.marginSM }}>
      <span
        className="agent-icon-badge"
        aria-hidden="true"
        style={{
          display: 'grid',
          placeItems: 'center',
          width: 22,
          height: 22,
          flex: 'none',
          borderRadius: token.borderRadius
        }}
      >
        <StudioIcon name="bot" size={12} />
      </span>
      <Typography.Text strong>SQL Studio AI</Typography.Text>
      {model && (
        <Tag icon={<DeepSeekLogo size={11} />} style={{ marginInlineEnd: 0, maxWidth: '100%', overflowWrap: 'anywhere', whiteSpace: 'normal' }}>
          {model}
        </Tag>
      )}
    </Flex>
  )
}

export function TurnContent({ entries, busy, waiting, locked, status, assistantModel, expanded, onExpanded, onEdit }: Props) {
  const { t, language } = useTranslation()

  const { token } = theme.useToken()
  const sections = blocks(entries)
  const assistantBody = (content: ReactNode) => <div style={{ paddingInlineStart: 30, minWidth: 0 }}>{content}</div>
  const headSection = sections.findIndex((block) => block.type !== 'footer' && block.entries[0]?.role !== 'user')
  return (
    <Flex vertical gap={CHAT.spacing.block} style={{ width: '100%', minWidth: 0, paddingBottom: token.padding }}>
      {sections.map((block, sectionIndex) => {
        const first = block.entries[0]
        if (block.type === 'footer')
          return (
            <Fragment key={`errors-${first.id}`}>
              {block.entries
                .filter((entry) => entry.stopped)
                .map((entry) => (
                  <Alert key={entry.id} type="info" showIcon title={t(entry.text)} />
                ))}
              {assistantBody(<RoundFooter entries={block.entries} ongoing={busy && block === sections[sections.length - 1]} waiting={waiting} />)}
            </Fragment>
          )
        if (block.type === 'process') {
          const key = `process-${first.id}`
          const toolCount = block.entries.filter((entry) => entry.role === 'tool').length
          const hasThinking = toolCount < block.entries.length
          let title = t('DeepSeek 思考过程')
          if (toolCount) title = t('{value1} · {value2} 项操作', { value1: t(hasThinking ? '思考与执行' : '执行过程'), value2: toolCount })
          else if (block.entries.some((entry) => entry.streaming)) title = t('DeepSeek 正在思考…')
          else if (block.entries.some((entry) => entry.incomplete)) title = t('思考过程（未完成）')
          return (
            <Fragment key={key}>
              {sectionIndex === headSection && <AssistantHead model={assistantModel} />}
              {assistantBody(
                <ProcessCard
                  title={title}
                  icon={hasThinking ? undefined : <CodeOutlined style={{ color: token.colorTextSecondary, fontSize: token.fontSize, width: token.fontSize, height: token.fontSize }} />}
                  expanded={expanded.includes(key)}
                  onExpand={(open) => {
                    const remaining = expanded.filter((id) => id !== key)
                    onExpanded(open ? [...remaining, key] : remaining)
                  }}
                >
                  <ProcessDetails entries={block.entries} />
                </ProcessCard>
              )}
            </Fragment>
          )
        }
        return block.entries.map((e) => {
          const user = e.role === 'user'
          if (user)
            return (
              <Flex key={e.id} className="user-message" vertical gap={CHAT.spacing.detail} style={{ width: '100%', minWidth: 0 }}>
                <Bubble
                  placement="end"
                  variant="outlined"
                  styles={{ root: { width: '100%' }, body: { maxWidth: '78%', minWidth: 0 } }}
                  content={
                    <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', margin: 0, maxWidth: '100%' }}>
                      {e.text}
                      {e.incomplete && <Typography.Text type="secondary">{t('（未完成）')}</Typography.Text>}
                    </Typography.Paragraph>
                  }
                />
                <Flex className="user-message-actions" justify="end" align="center" gap={CHAT.spacing.detail} wrap>
                  {e.createdAt && <Typography.Text type="secondary">{new Date(e.createdAt).toLocaleString(language, { hour12: false })}</Typography.Text>}
                  <Tooltip title={t('编辑问题')}>
                    <Button type="text" size="small" aria-label={t('编辑问题')} disabled={locked} icon={<EditOutlined />} onClick={() => onEdit(e.text)} />
                  </Tooltip>
                  <Typography.Text copyable={{ text: e.text, tooltips: [t('复制问题'), t('已复制')] }} />
                </Flex>
              </Flex>
            )
          return (
            <Fragment key={e.id}>
              {sectionIndex === headSection && <AssistantHead model={assistantModel} />}
              {assistantBody(
                <Bubble
                  placement="start"
                  variant="borderless"
                  styles={{
                    root: { width: '100%' },
                    body: { width: '100%', maxWidth: '100%', minWidth: 0 },
                    content: { padding: 0, maxWidth: '100%', width: '100%' }
                  }}
                  content={<AnswerContent text={e.text} streaming={e.streaming} />}
                />
              )}
            </Fragment>
          )
        })
      })}
      {busy && !waiting && (
        <Flex align="center" gap={CHAT.spacing.detail}>
          <LoadingOutlined spin />
          <Typography.Text type="secondary">{t(status || '正在思考…')}</Typography.Text>
        </Flex>
      )}
    </Flex>
  )
}
