import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'

const minimumWidth = 200
const maximumWidth = 560
const defaultWidth = 272

/** 拖动只更新临时宽度，结束时提交布局，避免每个像素都加密保存整个工作区。 */
export function useSidebarResize(width: number, onWidthChange: (width: number) => void) {
  const panel = useRef<HTMLElement>(null)
  const drag = useRef<{ x: number; start: number; current: number } | null>(null)
  const [preview, setPreview] = useState<number | null>(null)
  const [limit, setLimit] = useState(maximumWidth)
  const clamp = (value: number) => Math.max(minimumWidth, Math.min(value, limit))
  const visibleWidth = clamp(preview ?? width)
  useEffect(() => {
    const parent = panel.current?.parentElement
    if (!parent) return
    const measure = () => setLimit(Math.max(minimumWidth, Math.min(maximumWidth, parent.clientWidth - 520)))
    const observer = new ResizeObserver(measure)
    observer.observe(parent)
    measure()
    return () => observer.disconnect()
  }, [])
  const finish = () => {
    const current = drag.current
    drag.current = null
    if (current) onWidthChange(clamp(current.current))
    setPreview(null)
  }
  const resizer = {
    onDoubleClick: () => onWidthChange(clamp(defaultWidth)),
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return
      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
      drag.current = { x: event.clientX, start: visibleWidth, current: visibleWidth }
      setPreview(visibleWidth)
    },
    onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
      if (!drag.current) return
      const next = clamp(drag.current.start + event.clientX - drag.current.x)
      drag.current.current = next
      setPreview(next)
    },
    onPointerUp: (event: PointerEvent<HTMLDivElement>) => {
      finish()
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    },
    onPointerCancel: finish,
    onLostPointerCapture: finish,
    onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
      event.preventDefault()
      onWidthChange(clamp(event.key === 'Home' ? minimumWidth : event.key === 'End' ? limit : visibleWidth + (event.key === 'ArrowRight' ? 24 : -24)))
    }
  }
  return { panel, visibleWidth, minimumWidth, maximumWidth: limit, resizing: preview !== null, resizer }
}
