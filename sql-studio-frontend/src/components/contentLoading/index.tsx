import { Spin } from 'antd'

export default function ContentLoading({ label, className }: { label: string; className?: string }) {
  return (
    <div role="status" className={className ? `content-loading ${className}` : 'content-loading'}>
      <Spin description={label} />
    </div>
  )
}
