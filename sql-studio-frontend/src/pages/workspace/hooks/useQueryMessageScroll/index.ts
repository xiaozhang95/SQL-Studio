import { useCallback, useLayoutEffect, useRef } from 'react'

interface Options {
  identity: string | undefined
  progress: number
  page: number
  latest: boolean
  running: boolean
  onFollowChange: (following: boolean) => void
}

/** Follow appended receipts within the actual result viewport; never scroll the editor or page. */
export function useQueryMessageScroll(options: Options) {
  const content = useRef<HTMLDivElement>(null)
  const current = useRef(options)
  const following = useRef(options.running && options.latest)
  const previous = useRef<{ identity: Options['identity']; page: number } | null>(null)
  const previousTop = useRef(0)
  useLayoutEffect(() => {
    current.current = options
  })

  const pause = useCallback(() => {
    if (!following.current) return
    following.current = false
    current.current.onFollowChange(false)
  }, [])
  const toBottom = useCallback(() => {
    const viewport = content.current?.parentElement
    if (!viewport || !following.current || !current.current.latest) return
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
      if (current.current.latest && atBottom && !following.current) {
        following.current = true
        current.current.onFollowChange(true)
      } else if (top < previousTop.current && !atBottom) pause()
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

  useLayoutEffect(() => {
    const viewport = content.current?.parentElement
    if (!viewport) return
    const prior = previous.current
    const newRun = !prior || prior.identity !== options.identity
    const newPage = prior?.page !== options.page
    if (newRun) following.current = options.running && options.latest
    if (!options.latest) following.current = false
    if ((newRun || newPage) && !following.current) viewport.scrollTo({ top: 0 })
    previousTop.current = viewport.scrollTop
    previous.current = { identity: options.identity, page: options.page }
    toBottom()
  }, [options.identity, options.progress, options.page, options.latest, options.running, toBottom])

  return { content, pause }
}
