import { useLayoutEffect, useRef, useState } from 'react'

import type { ConversationRound } from '../../../../utils/conversationRounds'
import { CHAT } from '../../constant/chat'

type Alignment = 'start' | 'end'
type Placement = { index: number; align: Alignment } | { index: number; offset: number; viewportOffset: number }

const { windowSize, estimatedHeight, loadingMinDuration, edgeTolerance } = CHAT.roundSwitch
const midpoint = Math.floor(windowSize / 2)

function isAtBottom(element: HTMLElement) {
  return element.scrollHeight - element.clientHeight - element.scrollTop <= edgeTolerance
}

function roundElements(viewport: HTMLElement) {
  return Array.from(viewport.querySelectorAll<HTMLElement>('[data-chat-round]'))
}

function roundIndex(element: HTMLElement) {
  return Number(element.dataset.roundIndex)
}

function centeredStart(index: number, maxStart: number) {
  return Math.min(maxStart, Math.max(0, index - midpoint))
}

export function useRoundTranscript(rounds: ConversationRound[], attention = false, live = false) {
  const latest = rounds.length - 1
  const maxStart = Math.max(0, rounds.length - windowSize)
  const viewport = useRef<HTMLDivElement>(null)
  const [heights, setHeights] = useState(new Map<number, number>())
  const [windowStart, setWindowStart] = useState(maxStart)
  const [activeIndex, setActiveIndex] = useState(Math.max(0, latest))
  const [loading, setLoading] = useState(false)
  const [atBottom, setAtBottom] = useState(true)
  const lastQuestion = useRef(rounds.at(-1)?.id)
  const previousAttention = useRef(false)
  const following = useRef(live)
  const readingIndex = useRef(latest)
  const lastScrollTop = useRef(0)
  const placement = useRef<Placement | null>({ index: latest, align: live ? 'end' : 'start' })
  const loadingSince = useRef<number | null>(null)
  const loadingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const start = Math.min(windowStart, maxStart)
  const end = Math.min(rounds.length, start + windowSize)
  const offsets = [0]
  for (const round of rounds) offsets.push(offsets[offsets.length - 1] + (heights.get(round.id) ?? estimatedHeight))

  function position(element: HTMLElement, top: number) {
    if (Math.abs(element.scrollTop - top) > edgeTolerance) element.scrollTop = top
    lastScrollTop.current = element.scrollTop
    setAtBottom(isAtBottom(element))
  }

  function applyPlacement(element: HTMLElement) {
    const target = placement.current
    if (!target) return false
    const item = roundElements(element).find((node) => roundIndex(node) === target.index)
    if (!item) return false
    placement.current = null
    const top =
      'align' in target
        ? item.offsetTop + (target.align === 'end' ? item.offsetHeight - element.clientHeight : 0)
        : item.offsetTop + Math.min(target.offset, item.offsetHeight - 1) - target.viewportOffset
    position(element, top)
    if (loadingSince.current !== null && loadingTimer.current === null) {
      loadingTimer.current = setTimeout(
        () => {
          loadingSince.current = null
          loadingTimer.current = null
          setLoading(false)
        },
        Math.max(0, loadingMinDuration - (performance.now() - loadingSince.current))
      )
    }
    return true
  }

  function jump(index: number, align: Alignment = 'start') {
    if (!rounds[index]) return
    placement.current = { index, align }
    following.current = index === latest && align === 'end'
    readingIndex.current = index
    setActiveIndex(index)
    const element = viewport.current
    if (element && applyPlacement(element)) return
    setWindowStart(centeredStart(index, maxStart))
  }

  function onScroll() {
    const element = viewport.current
    if (!element) return
    const top = element.scrollTop
    const direction = Math.sign(top - lastScrollTop.current)
    lastScrollTop.current = top
    const bottom = isAtBottom(element)
    setAtBottom(bottom)
    if (!direction) return
    following.current = bottom
    const focusOffset = element.clientHeight / 3
    const focus = top + focusOffset
    const item = roundElements(element).find((node) => focus >= node.offsetTop && focus < node.offsetTop + node.offsetHeight)

    if (!item) {
      const index = bottom ? latest : offsets.findIndex((offset) => offset > focus) - 1
      if (!rounds[index] || (index >= start && index < end)) return
      readingIndex.current = index
      setActiveIndex(index)
      placement.current = bottom ? { index, align: 'end' } : { index, offset: Math.max(0, focus - offsets[index]), viewportOffset: focusOffset }
      if (loadingTimer.current !== null) clearTimeout(loadingTimer.current)
      loadingTimer.current = null
      setLoading(true)
      setWindowStart(centeredStart(index, maxStart))
      return
    }

    const index = roundIndex(item)
    readingIndex.current = index
    setActiveIndex(bottom ? latest : index)
    const middle = start + midpoint
    if ((direction < 0 && index > middle) || (direction > 0 && index < middle)) return
    const nextStart = Math.max(0, Math.min(maxStart, start + direction))
    if (nextStart === start) return
    placement.current = { index, offset: focus - item.offsetTop, viewportOffset: focusOffset }
    setWindowStart(nextStart)
  }

  useLayoutEffect(() => {
    if (loading) loadingSince.current ??= performance.now()
  }, [loading])

  useLayoutEffect(() => {
    const id = rounds.at(-1)?.id
    const needsAttention = attention && !previousAttention.current
    previousAttention.current = attention
    if (lastQuestion.current === id && !needsAttention) return
    lastQuestion.current = id
    jump(latest, needsAttention ? 'end' : 'start')
    following.current = true
  })

  useLayoutEffect(() => {
    const element = viewport.current
    if (element) applyPlacement(element)
  })

  useLayoutEffect(() => {
    const element = viewport.current
    if (!element) return
    const items = roundElements(element)
    const measured = new Map(items.map((item) => [Number(item.dataset.chatRound), item.offsetHeight]))
    function saveHeights(updates: ReadonlyMap<number, number>) {
      setHeights((previous) => {
        if ([...updates].every(([id, height]) => previous.get(id) === height)) return previous
        return new Map([...previous, ...updates])
      })
    }
    saveHeights(new Map(measured))
    const observer = new ResizeObserver((entries) => {
      let heightChangeAbove = 0
      const updates = new Map<number, number>()
      for (const { target } of entries) {
        if (!(target instanceof HTMLElement) || target === element) continue
        const id = Number(target.dataset.chatRound)
        const height = target.offsetHeight
        if (height === measured.get(id)) continue
        if (roundIndex(target) < readingIndex.current) heightChangeAbove += height - (measured.get(id) ?? height)
        measured.set(id, height)
        updates.set(id, height)
      }
      if (updates.size) saveHeights(updates)
      if (following.current) position(element, element.scrollHeight)
      else if (heightChangeAbove) position(element, element.scrollTop + heightChangeAbove)
      else setAtBottom(isAtBottom(element))
    })
    for (const item of items) observer.observe(item)
    observer.observe(element)
    return () => observer.disconnect()
  }, [start, end])

  useLayoutEffect(
    () => () => {
      if (loadingTimer.current !== null) clearTimeout(loadingTimer.current)
    },
    []
  )

  return {
    viewport,
    start,
    end,
    paddingTop: offsets[start],
    paddingBottom: offsets[rounds.length] - offsets[end],
    activeIndex,
    loading,
    atBottom,
    jump,
    onScroll,
    toLatest: () => jump(latest, 'end')
  }
}
