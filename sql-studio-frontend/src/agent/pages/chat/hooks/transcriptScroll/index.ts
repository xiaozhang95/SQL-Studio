import { useEffect, useRef } from 'react'

import type { Entry } from '../../../../typings/chat'

export function useTranscriptScroll(entries: Entry[], busy: boolean) {
  const end = useRef<HTMLDivElement>(null)
  const following = useRef(true)
  const lastUser = useRef<Entry['id'] | undefined>(undefined)
  const userId = [...entries].reverse().find((entry) => entry.role === 'user')?.id
  useEffect(() => {
    const scroll = end.current?.closest<HTMLElement>('.chat-scroll')
    if (!scroll) return
    const onScroll = () => {
      following.current = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 96
    }
    scroll.addEventListener('scroll', onScroll, { passive: true })
    return () => scroll.removeEventListener('scroll', onScroll)
  }, [])
  useEffect(() => {
    if (userId !== lastUser.current) {
      following.current = true
      lastUser.current = userId
    }
    if (!following.current) return
    const frame = requestAnimationFrame(() => {
      const scroll = end.current?.closest<HTMLElement>('.chat-scroll')
      if (scroll) scroll.scrollTop = scroll.scrollHeight
    })
    return () => cancelAnimationFrame(frame)
  }, [entries, busy, userId])
  return end
}
