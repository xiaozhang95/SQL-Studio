import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'

import { readLocal, saveLocal } from '@/utils/storage'

/** 面板只管理尺寸与交互，执行数据通过 children 注入。 */
type Props = { header: ReactNode; children: ReactNode }
const minimumHeight = 180
const defaultHeight = 260

export default function ResultsDock({ header, children }: Props) {
  const panel = useRef<HTMLElement | null>(null)
  const drag = useRef<{ y: number; height: number } | null>(null)
  const [height, setHeight] = useState(() => {
    const saved = readLocal<number>('sqldesk.resultHeight', defaultHeight)
    return typeof saved === 'number' && Number.isFinite(saved) ? Math.max(minimumHeight, saved) : defaultHeight
  })
  const [maximumHeight, setMaximumHeight] = useState(defaultHeight)
  const [resizing, setResizing] = useState(false)
  const visibleHeight = Math.min(height, maximumHeight)

  useEffect(() => {
    const parent = panel.current?.parentElement
    if (!parent) return
    const observer = new ResizeObserver(() => {
      // 给编辑器及其工具栏保留空间，窗口缩小时同步收紧拖动边界。
      setMaximumHeight(Math.max(minimumHeight, parent.clientHeight - 280))
    })
    observer.observe(parent)
    return () => observer.disconnect()
  }, [])
  useEffect(() => saveLocal('sqldesk.resultHeight', height), [height])

  const resize = (value: number) => setHeight(Math.max(minimumHeight, Math.min(value, maximumHeight)))
  const endDrag = () => {
    drag.current = null
    setResizing(false)
  }

  return (
    <section ref={panel} className={`results-panel${resizing ? ' is-resizing' : ''}`} aria-label="查询结果面板" style={{ '--results-height': `${visibleHeight}px` } as CSSProperties}>
      <div
        className="results-resizer"
        role="separator"
        aria-label="调整结果面板高度"
        aria-orientation="horizontal"
        aria-valuemin={minimumHeight}
        aria-valuemax={maximumHeight}
        aria-valuenow={Math.round(visibleHeight)}
        tabIndex={0}
        onDoubleClick={() => resize(defaultHeight)}
        onPointerDown={(event) => {
          if (event.button !== 0) return
          event.preventDefault()
          event.currentTarget.setPointerCapture(event.pointerId)
          drag.current = { y: event.clientY, height: visibleHeight }
          setResizing(true)
        }}
        onPointerMove={(event) => {
          if (!drag.current) return
          resize(drag.current.height + drag.current.y - event.clientY)
        }}
        onPointerUp={(event) => {
          endDrag()
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
        }}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
        onKeyDown={(event) => {
          if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
          event.preventDefault()
          resize(event.key === 'Home' ? minimumHeight : event.key === 'End' ? maximumHeight : visibleHeight + (event.key === 'ArrowUp' ? 24 : -24))
        }}
      >
        <span />
      </div>
      <div className="result-tabs-row">{header}</div>
      <div className="result-panel-content">{children}</div>
    </section>
  )
}
