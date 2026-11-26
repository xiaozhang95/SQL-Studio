import { useCallback, useLayoutEffect, useRef } from 'react'

interface Options {
  progress: number
  running: boolean
}

/** Follow appended receipts within the actual result viewport; never scroll the editor or page. */
export function useQueryMessageScroll({ progress, running }: Options) {
  const content = useRef<HTMLDivElement>(null)
  const following = useRef(running)
  const previousTop = useRef(0)

  const pause = useCallback(() => {
    following.current = false
  }, [])
  const toBottom = useCallback(() => {
    const viewport = content.current?.parentElement
    if (!viewport || !following.current) return
    viewport.scrollTo({ top: viewport.scrollHeight })
    previousTop.current = viewport.scrollTop
  }, [])

  useLayoutEffect(() => {
    const element = content.current
    const viewport = element?.parentElement
    if (!element || !viewport) return
    const onScroll = () => {
      const top = viewport.scrollTop
      const atBottom = viewport.scrollHeight - viewport.clientHeight - top <= 2
      if (atBottom) following.current = true
      else if (top < previousTop.current) pause()
      previousTop.current = top
    }
    const onWheel = (event: WheelEvent) => {
      if (event.deltaY < 0) pause()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (['ArrowUp', 'PageUp', 'Home'].includes(event.key)) pause()
    }
    viewport.addEventListener('scroll', onScroll, { passive: true })
    viewport.addEventListener('wheel', onWheel, { passive: true })
    viewport.addEventListener('keydown', onKeyDown)
    const observer = new ResizeObserver(toBottom)
    observer.observe(element)
    observer.observe(viewport)
    return () => {
      observer.disconnect()
      viewport.removeEventListener('scroll', onScroll)
      viewport.removeEventListener('wheel', onWheel)
      viewport.removeEventListener('keydown', onKeyDown)
    }
  }, [pause, toBottom])

  useLayoutEffect(toBottom, [progress, running, toBottom])

  return content
}
