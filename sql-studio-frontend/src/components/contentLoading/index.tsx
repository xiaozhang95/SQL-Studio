import { Spin } from 'antd'
import type { CSSProperties } from 'react'

export default function ContentLoading({ label, className, style }: { label: string; className?: string; style?: CSSProperties }) {
  return (
    <div
      role="status"
      className={className ? `content-loading ${className}` : 'content-loading'}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', flex: 1, minHeight: 0, ...style }}
    >
      <Spin description={label} />
    </div>
  )
}
