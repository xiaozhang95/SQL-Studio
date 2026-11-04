import type { ReactNode } from 'react'

export default function PageHeader({
  children,
  actions,
  title,
  titleClassName,
  titleOffset = 0
}: {
  children: ReactNode
  actions: ReactNode
  title?: ReactNode
  titleClassName?: string
  titleOffset?: number
}) {
  return (
    <header
      className="topbar"
      style={{
        minHeight: 56,
        flex: 'none',
        padding: '0 var(--workspace-inset)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--workspace-inset)',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        userSelect: 'none',
        position: 'relative'
      }}
    >
      <div className="topbar-actions" style={{ display: 'flex', alignItems: 'center', gap: 'var(--workspace-inset)', minWidth: 0 }}>
        {children}
      </div>
      {title && (
        <div
          className={titleClassName}
          style={{
            position: 'absolute',
            left: `calc(50% + ${titleOffset}px)`,
            transform: 'translateX(-50%)',
            maxWidth: '30%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            pointerEvents: 'none'
          }}
        >
          {title}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>{actions}</div>
    </header>
  )
}
