import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { resultPanelLayout } from '../../constant/layout'

/** 面板只管理尺寸与交互，执行数据通过 children 注入。 */
type Props = {
  children: ReactNode
  resizable: boolean
  height: number
  onHeightChange: (height: number) => void
}
const { minimumHeight, defaultHeight, editorReservedHeight, keyboardStep } = resultPanelLayout
export default function ResultsDock({ children, resizable, height, onHeightChange }: Props) {
  const panel = useRef<HTMLElement | null>(null)
  const drag = useRef<{
    y: number
    height: number
  } | null>(null)
  const [maximumHeight, setMaximumHeight] = useState<number>(defaultHeight)
  const [resizing, setResizing] = useState(false)
  const visibleHeight = Math.max(minimumHeight, Math.min(height, maximumHeight))
  useEffect(() => {
    if (!resizable) return
    const parent = panel.current?.parentElement
    if (!parent) return
    const observer = new ResizeObserver(() => {
      // 给编辑器及其工具栏保留空间，窗口缩小时同步收紧拖动边界。
      setMaximumHeight(Math.max(minimumHeight, parent.clientHeight - editorReservedHeight))
    })
    observer.observe(parent)
    return () => observer.disconnect()
  }, [resizable])
  const resize = (value: number) => onHeightChange(Math.max(minimumHeight, Math.min(value, maximumHeight)))
  const endDrag = () => {
    drag.current = null
    setResizing(false)
  }
  return (
    <section
      ref={panel}
      className={`results-panel${resizing ? ' is-resizing' : ''}${resizable ? '' : ' is-standalone'}`}
      aria-label="查询结果面板"
      style={{
        position: 'relative',
        height: resizable ? visibleHeight : 'auto',
        flex: resizable ? 'none' : 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--surface)',
        overflow: 'hidden',
        borderTop: resizable ? '1px solid var(--border)' : 0,
        paddingTop: resizable ? 5 : 0,
        userSelect: resizing ? 'none' : undefined
      }}
    >
      {resizable && (
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
            resize(event.key === 'Home' ? minimumHeight : event.key === 'End' ? maximumHeight : visibleHeight + (event.key === 'ArrowUp' ? keyboardStep : -keyboardStep))
          }}
          style={{ position: 'absolute', insetInline: 0, top: 0, height: 5, zIndex: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'row-resize', touchAction: 'none' }}
        >
          <span style={{ width: 48, height: 2, borderRadius: 0, background: resizing ? 'var(--ant-color-text-secondary)' : 'var(--resize-grip-color, var(--border))' }} />
        </div>
      )}
      <div className="result-panel-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        {children}
      </div>
    </section>
  )
}
