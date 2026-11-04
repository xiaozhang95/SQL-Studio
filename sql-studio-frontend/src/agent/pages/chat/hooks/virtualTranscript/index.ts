import { startTransition, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { VirtuosoHandle } from 'react-virtuoso'

import type { ConversationRound } from '../../../../utils/conversationRounds'
import { CHAT } from '../../constant/chat'

export function useVirtualTranscript(rounds: ConversationRound[]) {
  const list = useRef<VirtuosoHandle>(null)
  const following = useRef(true)
  const latestQuestion = useRef(rounds.at(-1)?.id)
  const [first, setFirst] = useState(Math.max(0, rounds.length - CHAT.historyBatchSize))
  const [loadingHistory, setLoadingHistory] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingJump = useRef<number | null>(null)
  const atTop = useRef(false)
  const [activeIndex, setActiveIndex] = useState(Math.max(0, rounds.length - 1))
  const [atBottom, setAtBottom] = useState(true)
  const visibleRounds = useMemo(() => rounds.slice(first), [rounds, first])
  useLayoutEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    []
  )
  useLayoutEffect(() => {
    timer.current = null
  }, [first])
  useLayoutEffect(() => {
    const last = rounds.at(-1)?.id
    const newQuestion = latestQuestion.current !== last
    latestQuestion.current = last
    if (newQuestion) following.current = true
    const target = pendingJump.current
    pendingJump.current = null
    if (target === null && !following.current) return
    const frame = requestAnimationFrame(() => {
      list.current?.scrollToIndex({ index: (target ?? rounds.length - 1) - first, align: target === null ? 'end' : 'start' })
    })
    return () => cancelAnimationFrame(frame)
  }, [rounds, first])
  function loadOlder() {
    if (!first || timer.current) return
    following.current = false
    setLoadingHistory(true)
    // Paint the inline boundary indicator before mounting older rounds.
    timer.current = setTimeout(() => {
      startTransition(() => {
        setFirst((current) => Math.max(0, current - CHAT.historyBatchSize))
        setLoadingHistory(false)
      })
    }, CHAT.historyLoadingDelay)
  }
  function jump(index: number) {
    following.current = false
    setActiveIndex(index)
    if (index < first) {
      if (timer.current) clearTimeout(timer.current)
      timer.current = null
      setLoadingHistory(false)
      pendingJump.current = index
      setFirst(Math.max(0, index - CHAT.historyBatchSize + 1))
    } else list.current?.scrollToIndex({ index: index - first, align: 'start' })
  }
  return {
    list,
    visibleRounds,
    first,
    loadingHistory,
    loadOlder,
    activeIndex,
    atBottom,
    jump,
    onTop: (top: boolean) => {
      atTop.current = top
      if (top && !following.current) loadOlder()
    },
    onBottom: (bottom: boolean) => {
      if (bottom) following.current = true
      setAtBottom(bottom)
    },
    onReadHistory: () => {
      following.current = false
      if (atTop.current) loadOlder()
    },
    onHeight: () => {
      if (following.current) list.current?.scrollToIndex({ index: rounds.length - 1 - first, align: 'end' })
    },
    onRange: ({ startIndex }: { startIndex: number }) => setActiveIndex(startIndex),
    toLatest: () => {
      following.current = true
      list.current?.scrollToIndex({ index: rounds.length - 1 - first, align: 'end' })
    }
  }
}
