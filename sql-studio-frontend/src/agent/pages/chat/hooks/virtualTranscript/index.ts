import { useLayoutEffect, useRef, useState } from 'react'
import type { VirtuosoHandle } from 'react-virtuoso'

import type { ConversationRound } from '../../../../utils/conversationRounds'

export function useVirtualTranscript(rounds: ConversationRound[]) {
  const list = useRef<VirtuosoHandle>(null)
  const following = useRef(true)
  const latestQuestion = useRef(rounds.at(-1)?.id)
  const [activeIndex, setActiveIndex] = useState(Math.max(0, rounds.length - 1))
  const [atBottom, setAtBottom] = useState(true)
  useLayoutEffect(() => {
    const last = rounds.at(-1)?.id
    const newQuestion = latestQuestion.current !== last
    latestQuestion.current = last
    if (newQuestion) following.current = true
    if (!following.current) return
    const frame = requestAnimationFrame(() => {
      if (newQuestion) list.current?.scrollToIndex({ index: rounds.length - 1, align: 'end' })
      else list.current?.scrollToIndex({ index: rounds.length - 1, align: 'end' })
    })
    return () => cancelAnimationFrame(frame)
  }, [rounds])
  function jump(index: number) {
    following.current = false
    setActiveIndex(index)
    list.current?.scrollToIndex({ index, align: 'start' })
  }
  return {
    list,
    activeIndex,
    atBottom,
    jump,
    onBottom: (bottom: boolean) => {
      if (bottom) following.current = true
      setAtBottom(bottom)
    },
    onReadHistory: () => {
      following.current = false
    },
    onHeight: () => {
      if (following.current) list.current?.scrollToIndex({ index: rounds.length - 1, align: 'end' })
    },
    onRange: ({ startIndex }: { startIndex: number }) => setActiveIndex(startIndex),
    toLatest: () => {
      following.current = true
      list.current?.scrollToIndex({ index: rounds.length - 1, align: 'end' })
    }
  }
}
