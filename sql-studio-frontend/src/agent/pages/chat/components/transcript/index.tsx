import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons'
import { Button, Flex, theme } from 'antd'
import { useMemo } from 'react'
import type { ReactNode } from 'react'

import ContentLoading from '@/components/contentLoading'

import type { Entry } from '../../../../typings/chat'
import { conversationRounds } from '../../../../utils/conversationRounds'
import { CHAT } from '../../constant/chat'
import { useRoundTranscript } from '../../hooks/roundTranscript'
import { RoundNavigation } from '../roundNavigation'
import { TurnContent } from '../turnContent'

interface Props {
  entries: Entry[]
  busy: boolean
  status: string
  expanded: string[]
  onExpanded: (keys: string[]) => void
  onEdit: (text: string) => void
  confirmation?: ReactNode
}
export function Transcript({ entries, busy, status, expanded, onExpanded, onEdit, confirmation }: Props) {
  const { token } = theme.useToken()
  const rounds = useMemo(() => conversationRounds(entries), [entries])
  const { viewport: viewportRef, content: contentRef, round, activeIndex, loading, atBottom, jump, onScroll, previous, next, toLatest } = useRoundTranscript(rounds, Boolean(confirmation), busy)
  const latest = activeIndex === rounds.length - 1
  return (
    <Flex vertical style={{ height: '100%', minHeight: 0, position: 'relative', width: '100%' }}>
      <RoundNavigation rounds={rounds} activeIndex={activeIndex} onJump={jump} />
      <Flex
        vertical
        gap="small"
        role="group"
        aria-label="切换对话轮次"
        style={{
          position: 'absolute',
          top: '50%',
          insetInlineEnd: `max(${token.paddingSM}px, calc((100% - ${CHAT.conversationMaxWidth}px) / 2 - ${CHAT.roundSwitch.sideOffset}px))`,
          transform: 'translateY(-50%)',
          zIndex: 1
        }}
      >
        <Button size="small" shape="circle" aria-label="上一轮" title="上一轮" icon={<ArrowUpOutlined />} onClick={previous} disabled={activeIndex === 0 || loading} />
        <Button size="small" shape="circle" aria-label="下一轮" title="下一轮" icon={<ArrowDownOutlined />} onClick={next} disabled={latest || loading} />
      </Flex>
      <div ref={viewportRef} className="chat-scroll" role="region" aria-label="当前轮对话" aria-busy={loading} tabIndex={0} onScroll={onScroll}>
        {loading ? (
          <ContentLoading label={'正在加载第 ' + (activeIndex + 1) + ' 轮对话…'} />
        ) : round ? (
          <div ref={contentRef} key={round.id} data-chat-round={round.id} style={{ ...CHAT.content, paddingBlock: token.paddingXS }}>
            <TurnContent
              locked={busy}
              entries={round.entries}
              busy={busy && latest}
              waiting={latest && Boolean(confirmation)}
              status={status}
              expanded={expanded}
              onExpanded={onExpanded}
              onEdit={onEdit}
            />
            {latest && confirmation}
          </div>
        ) : null}
      </div>
      {!loading && (!latest || !atBottom) && (
        <Button
          aria-label={confirmation && !latest ? '返回待确认回复' : '回到最新消息'}
          title={confirmation && !latest ? '返回待确认回复' : '回到最新消息'}
          size="small"
          shape="circle"
          icon={<ArrowDownOutlined />}
          onClick={toLatest}
          style={{ position: 'absolute', bottom: token.marginSM, left: '50%', transform: 'translateX(-50%)', zIndex: 1 }}
        />
      )}
    </Flex>
  )
}
