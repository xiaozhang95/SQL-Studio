import { theme } from 'antd'
import type { ReactNode } from 'react'

export default function EmptyStateIcon({ children }: { children: ReactNode }) {
  const { token } = theme.useToken()
  return <span style={{ color: 'var(--primary-foreground)', fontSize: token.controlHeightLG }}>{children}</span>
}
