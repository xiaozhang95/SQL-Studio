import { CaretDownFilled } from '@ant-design/icons'
import { Button, Flex, theme, Tooltip } from 'antd'
import { memo, useMemo } from 'react'
import type { CSSProperties, ReactNode } from 'react'

import ContentLoading from '@/components/contentLoading'

import type { Entry } from '../../../../typings/chat'
import { conversationRounds } from '../../../../utils/conversationRounds'
import { CHAT } from '../../constant/chat'
import { useRoundTranscript } from '../../hooks/roundTranscript'
import { RoundNavigation } from '../roundNavigation'
import { TurnContent } from '../turnContent'

const TranscriptTurn = memo(TurnContent)
const transcriptLayout = {
  height: '100%',
  minHeight: 0,
  position: 'relative',
  width: '100%'
} satisfies CSSProperties

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
  const { viewport: viewportRef, start, end, paddingTop, paddingBottom, activeIndex, loading, atBottom, jump, onScroll, toLatest } = useRoundTranscript(rounds, Boolean(confirmation), busy)
  return (
    <Flex vertical style={transcriptLayout}>
      <RoundNavigation rounds={rounds} activeIndex={activeIndex} onJump={jump} />
      <div
        ref={viewportRef}
        role="region"
        aria-label="对话记录"
        aria-busy={loading}
        tabIndex={0}
        onScroll={onScroll}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return
          if (event.key === 'Home') {
            event.preventDefault()
            jump(0)
          } else if (event.key === 'End') {
            event.preventDefault()
            toLatest()
          }
        }}
        style={{ position: 'relative', flex: 1, minHeight: 0, width: '100%', overflowY: 'auto', scrollbarGutter: 'stable', overscrollBehavior: 'contain', overflowAnchor: 'none' }}
      >
        <div aria-hidden="true" style={{ height: paddingTop }} />
        {rounds.slice(start, end).map((round, offset) => {
          const index = start + offset
          const isLatest = index === rounds.length - 1
          return (
            <div key={round.id} data-chat-round={round.id} data-round-index={index} style={{ ...CHAT.content, paddingBlock: token.paddingXS }}>
              <TranscriptTurn
                locked={busy}
                entries={round.entries}
                busy={busy && isLatest}
                waiting={isLatest && Boolean(confirmation)}
                status={status}
                expanded={expanded}
                onExpanded={onExpanded}
                onEdit={onEdit}
              />
              {isLatest && confirmation}
            </div>
          )
        })}
        <div aria-hidden="true" style={{ height: paddingBottom }} />
      </div>
      {loading && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <ContentLoading label="正在加载附近对话…" />
        </div>
      )}
      {!atBottom && (
        <Tooltip title="回到底部" trigger={['hover', 'focus']}>
          <Button
            {...CHAT.iconButton}
            aria-label="回到底部"
            icon={<CaretDownFilled />}
            onClick={toLatest}
            style={{ position: 'absolute', insetInlineEnd: `max(${token.marginLG}px, calc((100% - ${CHAT.conversationMaxWidth}px) * 0.35))`, insetBlockEnd: token.marginSM, zIndex: 1 }}
          />
        </Tooltip>
      )}
    </Flex>
  )
}
