import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'

import { CHAT } from '../../constant/chat'

export function useComposerResize() {
  const container = useRef<HTMLDivElement>(null)
  const drag = useRef<{ y: number; height: number } | null>(null)
  const [height, setHeight] = useState<number | null>(null)
  const [maximum, setMaximum] = useState<number>(CHAT.composerResize.maximumHeight)
  const minimum = Math.min(CHAT.composerResize.minimumHeight, maximum)
  const clamp = (value: number) => Math.max(minimum, Math.min(maximum, value))
  useEffect(() => {
    const region = container.current?.closest('.agent-conversation-column')
    if (!region) return
    const measure = () => setMaximum(Math.max(CHAT.composerResize.compactMinimumHeight, Math.min(CHAT.composerResize.maximumHeight, region.clientHeight - CHAT.composerResize.reservedHeight)))
    const observer = new ResizeObserver(measure)
    observer.observe(region)
    measure()
    return () => observer.disconnect()
  }, [])
  const finish = () => {
    drag.current = null
  }
  return {
    container,
    height: height === null ? undefined : clamp(height),
    minimum,
    maximum,
    resizer: {
      onDoubleClick: () => setHeight(null),
      onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) return
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        drag.current = { y: event.clientY, height: container.current?.clientHeight ?? minimum }
      },
      onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
        if (drag.current) setHeight(clamp(drag.current.height + drag.current.y - event.clientY))
      },
      onPointerUp: (event: PointerEvent<HTMLDivElement>) => {
        finish()
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
      },
      onPointerCancel: finish,
      onLostPointerCapture: finish,
      onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
        if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
        event.preventDefault()
        const current = height ?? container.current?.clientHeight ?? minimum
        setHeight(clamp(event.key === 'Home' ? minimum : event.key === 'End' ? maximum : current + (event.key === 'ArrowUp' ? CHAT.composerResize.keyboardStep : -CHAT.composerResize.keyboardStep)))
      }
    }
  }
}
