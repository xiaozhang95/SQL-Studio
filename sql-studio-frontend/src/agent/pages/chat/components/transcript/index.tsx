import { ArrowDownOutlined } from '@ant-design/icons'
import { Button, theme } from 'antd'
import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { Virtuoso } from 'react-virtuoso'

import type { Entry } from '../../../../typings/chat'
import { conversationRounds } from '../../../../utils/conversationRounds'
import { CHAT } from '../../constant/chat'
import { useVirtualTranscript } from '../../hooks/virtualTranscript'
import { ConversationLoading } from '../conversationLoading'
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
interface HistoryContext {
  hasOlder: boolean
  loading: boolean
  onLoad: () => void
}
function HistoryBoundary({ context }: { context?: HistoryContext }) {
  return (
    <div style={{ ...CHAT.content, height: CHAT.historyBoundaryHeight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {!context?.hasOlder ? null : context.loading ? (
        <ConversationLoading />
      ) : (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Button type="text" onClick={context.onLoad}>
            加载更早的消息
          </Button>
        </div>
      )}
    </div>
  )
}
const transcriptComponents = { Header: HistoryBoundary }
export function Transcript({ entries, busy, status, expanded, onExpanded, onEdit, confirmation }: Props) {
  const { token } = theme.useToken()
  const rounds = useMemo(() => conversationRounds(entries), [entries])
  const scroll = useVirtualTranscript(rounds)
  return (
    <div
      onWheel={scroll.onReadHistory}
      onTouchMove={scroll.onReadHistory}
      onKeyDown={(e) => {
        if (['ArrowUp', 'PageUp', 'Home'].includes(e.key)) scroll.onReadHistory()
      }}
      style={{ height: '100%', minHeight: 0, position: 'relative', width: '100%' }}
    >
      <RoundNavigation rounds={rounds} onJump={scroll.jump} />
      <Virtuoso
        className="chat-scroll"
        ref={scroll.list}
        style={{ height: '100%', width: '100%', scrollbarGutter: 'auto' }}
        data={scroll.visibleRounds}
        firstItemIndex={scroll.first}
        components={transcriptComponents}
        context={{ hasOlder: scroll.first > 0, loading: scroll.loadingHistory, onLoad: scroll.loadOlder }}
        computeItemKey={(_, round) => round.id}
        initialTopMostItemIndex={{ index: scroll.visibleRounds.length - 1, align: 'end' }}
        increaseViewportBy={{ top: 300, bottom: 400 }}
        atBottomThreshold={96}
        atBottomStateChange={scroll.onBottom}
        atTopStateChange={scroll.onTop}
        rangeChanged={scroll.onRange}
        followOutput={(atBottom) => (atBottom ? 'auto' : false)}
        totalListHeightChanged={scroll.onHeight}
        itemContent={(index, round) => (
          <div
            data-chat-round={round.id}
            style={{
              ...CHAT.content,
              paddingBlock: token.paddingXS
            }}
          >
            <TurnContent locked={busy} entries={round.entries} busy={busy && index === rounds.length - 1} status={status} expanded={expanded} onExpanded={onExpanded} onEdit={onEdit} />
            {index === rounds.length - 1 && confirmation}
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
