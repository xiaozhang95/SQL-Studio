import { startTransition, useCallback, useLayoutEffect, useRef, useState } from 'react'

import type { ConversationRound } from '../../../../utils/conversationRounds'
import { CHAT } from '../../constant/chat'

type Alignment = 'start' | 'end'

function isAtBottom(element: HTMLElement) {
  return element.scrollHeight - element.clientHeight - element.scrollTop <= CHAT.roundSwitch.edgeTolerance
}

export function useRoundTranscript(rounds: ConversationRound[], attention = false, live = false) {
  const viewport = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const [selectedId, setSelectedId] = useState(rounds.at(-1)?.id)
  const [destination, setDestination] = useState<number | null>(null)
  const [atBottom, setAtBottom] = useState(true)
  const lastQuestion = useRef(rounds.at(-1)?.id)
  const previousAttention = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const alignment = useRef<Alignment | null>('start')
  const following = useRef(live)
  const selectedIndex = Math.max(
    0,
    rounds.findIndex((round) => round.id === selectedId)
  )
  const activeIndex = destination ?? selectedIndex
  const loading = destination !== null
  const round = loading ? undefined : rounds[selectedIndex]

  const cancelSwitch = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = null
  }, [])
  const position = useCallback((align: Alignment) => {
    const element = viewport.current
    if (!element) return
    element.scrollTop = align === 'end' ? element.scrollHeight : 0
    setAtBottom(isAtBottom(element))
  }, [])
  const jump = useCallback(
    (index: number, align: Alignment = 'start') => {
      const target = rounds[index]
      if (!target || destination === index) return
      cancelSwitch()
      following.current = align === 'end' && index === rounds.length - 1
      if (target.id === selectedId && !loading) {
        position(align)
        return
      }
      setDestination(index)
      timer.current = setTimeout(() => {
        timer.current = null
        alignment.current = align
        startTransition(() => {
          setSelectedId(target.id)
          setDestination(null)
        })
      }, CHAT.roundSwitch.loadingDelay)
    },
    [rounds, destination, selectedId, loading, cancelSwitch, position]
  )
  function onScroll() {
    const element = viewport.current
    if (!element || loading) return
    const bottom = isAtBottom(element)
    setAtBottom(bottom)
    following.current = bottom && selectedIndex === rounds.length - 1
  }

  useLayoutEffect(() => cancelSwitch, [cancelSwitch])
  useLayoutEffect(() => {
    const latest = rounds.at(-1)?.id
    const needsAttention = attention && !previousAttention.current
    previousAttention.current = attention
    if (lastQuestion.current === latest && !needsAttention) return
    lastQuestion.current = latest
    cancelSwitch()
    following.current = true
    alignment.current = needsAttention ? 'end' : 'start'
    setSelectedId(latest)
    setDestination(null)
  }, [rounds, attention, cancelSwitch])
  useLayoutEffect(() => {
    if (loading) return
    if (alignment.current) {
      position(alignment.current)
      alignment.current = null
    } else if (following.current) position('end')
  }, [round, loading, attention, position])
  useLayoutEffect(() => {
    const element = content.current
    if (!element || loading) return
    const observer = new ResizeObserver(() => {
      if (following.current) position('end')
      else if (viewport.current) setAtBottom(isAtBottom(viewport.current))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [selectedId, loading, position])

  return {
    viewport,
    content,
    round,
    activeIndex,
    loading,
    atBottom,
    jump,
    onScroll,
    previous: () => jump(activeIndex - 1, 'end'),
    next: () => jump(activeIndex + 1),
    toLatest: () => jump(rounds.length - 1, 'end')
  }
}
