import { theme } from 'antd'
import { useLayoutEffect, useRef } from 'react'
import type { ReactNode } from 'react'

import DesktopTitleBar from '@/components/desktopTitleBar'

export default function PageHeader({
  children,
  actions,
  title,
  titleOffset = 0,
  showDesktopTitle = true,
  desktopTitle,
  desktopActive = true
}: {
  children: ReactNode
  actions: ReactNode
  title?: ReactNode
  titleOffset?: number
  showDesktopTitle?: boolean
  desktopTitle?: string
  desktopActive?: boolean
}) {
  const { token } = theme.useToken()
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
      const leftBounds = left.getBoundingClientRect()
      const rightBounds = right.getBoundingClientRect()
      const sameRow = leftBounds.top < rightBounds.bottom && rightBounds.top < leftBounds.bottom
      const available = sameRow ? Math.min(center - leftBounds.right, rightBounds.left - center) - gap : 0
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
          minHeight: token.controlHeight + token.paddingSM,
          flex: 'none',
          paddingInline: 'var(--workspace-inset)',
          paddingBlock: token.paddingXXS,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: token.marginXS,
          background: 'var(--surface)',
          borderBottom: '1px solid var(--layout-border)',
          userSelect: 'none',
          position: 'relative'
        }}
      >
        <div ref={leftActions} className="topbar-actions" style={{ display: 'flex', alignItems: 'center', gap: token.marginXXS, minWidth: 0, flexWrap: 'wrap' }}>
          {children}
        </div>
        {title && (
          <div
            ref={titleElement}
            style={{
              position: 'absolute',
              left: `calc(50% + ${titleOffset}px)`,
              transform: 'translateX(-50%)',
              maxWidth: 'var(--header-title-available-width, 0px)',
              fontSize: token.fontSizeLG,
              fontWeight: token.fontWeightStrong,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              pointerEvents: 'none'
            }}
          >
            {title}
          </div>
        )}
        <div ref={rightActions} style={{ display: 'flex', alignItems: 'center', gap: token.marginXS, flex: '0 1 auto', minWidth: 0, marginInlineStart: 'auto' }}>
          {actions}
        </div>
      </header>
    </>
  )
}
