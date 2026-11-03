import { ArrowDownOutlined } from '@ant-design/icons'
import { Button, theme } from 'antd'
import { useMemo } from 'react'
import { Virtuoso } from 'react-virtuoso'

import type { Entry } from '../../../../typings/chat'
import { conversationRounds } from '../../../../utils/conversationRounds'
import { useVirtualTranscript } from '../../hooks/virtualTranscript'
import { RoundNavigation } from '../roundNavigation'
import { TurnContent } from '../turnContent'

interface Props {
  entries: Entry[]
  busy: boolean
  status: string
  expanded: string[]
  onExpanded: (keys: string[]) => void
  onEdit: (text: string) => void
}
export function Transcript({ entries, busy, status, expanded, onExpanded, onEdit }: Props) {
  const { token } = theme.useToken()
  const rounds = useMemo(() => conversationRounds(entries), [entries])
  const scroll = useVirtualTranscript(rounds)
  return (
    <div style={{ height: '100%', minHeight: 0, position: 'relative', width: '100%' }}>
      <RoundNavigation rounds={rounds} onJump={scroll.jump} />
      <Virtuoso
        className="chat-scroll"
        ref={scroll.list}
        style={{ height: '100%', width: '100%', scrollbarGutter: 'auto' }}
        data={rounds}
        computeItemKey={(_, round) => round.id}
        initialTopMostItemIndex={{ index: rounds.length - 1, align: 'end' }}
        increaseViewportBy={{ top: 300, bottom: 400 }}
        atBottomThreshold={96}
        atBottomStateChange={scroll.onBottom}
        rangeChanged={scroll.onRange}
        followOutput={(atBottom) => (atBottom ? 'auto' : false)}
        itemContent={(index, round) => (
          <div
            data-chat-round={round.id}
            style={{
              width: '100%',
              paddingBlock: token.paddingXS
            }}
          >
            <TurnContent locked={busy} entries={round.entries} busy={busy && index === rounds.length - 1} status={status} expanded={expanded} onExpanded={onExpanded} onEdit={onEdit} />
          </div>
        )}
      />
      {!scroll.atBottom && (
        <Button
          aria-label="回到最新消息"
          shape="circle"
          icon={<ArrowDownOutlined />}
          onClick={scroll.toLatest}
          style={{ position: 'absolute', bottom: token.marginSM, insetInlineEnd: token.margin }}
        />
      )}
    </div>
  )
}
