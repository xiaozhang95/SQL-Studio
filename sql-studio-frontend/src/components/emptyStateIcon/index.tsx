import type { CSSProperties, ReactNode } from 'react'

const style = { color: 'var(--ant-color-primary)', fontSize: 36 } satisfies CSSProperties
export default function EmptyStateIcon({ children }: { children: ReactNode }) {
  return <span style={style}>{children}</span>
}
