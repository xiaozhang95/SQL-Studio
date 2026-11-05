import { useLayoutEffect, useRef } from 'react'
import type { ReactNode } from 'react'

import DesktopTitleBar from '@/components/desktopTitleBar'

export default function PageHeader({
  children,
  actions,
  title,
  titleClassName,
  titleOffset = 0,
  showDesktopTitle = true,
  desktopTitle,
  desktopActive = true
}: {
  children: ReactNode
  actions: ReactNode
  title?: ReactNode
  titleClassName?: string
  titleOffset?: number
  showDesktopTitle?: boolean
  desktopTitle?: string
  desktopActive?: boolean
}) {
  const titleElement = useRef<HTMLDivElement>(null)
  const leftActions = useRef<HTMLDivElement>(null)
  const rightActions = useRef<HTMLDivElement>(null)
  const hasTitle = Boolean(title)
  useLayoutEffect(() => {
    const label = titleElement.current
    const header = label?.parentElement
    const left = leftActions.current
    const right = rightActions.current
    if (!label || !header || !left || !right) return
    const measure = () => {
      const center = header.getBoundingClientRect().left + header.clientWidth / 2 + titleOffset
      const gap = parseFloat(getComputedStyle(header).columnGap) || 0
      const available = Math.min(center - left.getBoundingClientRect().right, right.getBoundingClientRect().left - center) - gap
      label.style.setProperty('--header-title-available-width', `${Math.max(0, available * 2)}px`)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(header)
    observer.observe(left)
    observer.observe(right)
    measure()
    return () => observer.disconnect()
  }, [hasTitle, titleOffset])
  return (
    <>
      <DesktopTitleBar showTitle={showDesktopTitle} title={desktopTitle} active={desktopActive} />
      <header
        className="topbar"
        style={{
          minHeight: 56,
          flex: 'none',
          paddingInline: 'var(--workspace-inset)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--workspace-inset)',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--layout-border)',
          userSelect: 'none',
          position: 'relative'
        }}
      >
        <div ref={leftActions} className="topbar-actions" style={{ display: 'flex', alignItems: 'center', gap: 'var(--workspace-inset)', minWidth: 0 }}>
          {children}
        </div>
        {title && (
          <div
            ref={titleElement}
            className={titleClassName}
            style={{
              position: 'absolute',
              left: `calc(50% + ${titleOffset}px)`,
              transform: 'translateX(-50%)',
              maxWidth: 'min(30%, var(--header-title-available-width, 30%))',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              pointerEvents: 'none'
            }}
          >
            {title}
          </div>
        )}
        <div ref={rightActions} style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0, marginInlineStart: 'auto' }}>
          {actions}
        </div>
      </header>
    </>
  )
}
