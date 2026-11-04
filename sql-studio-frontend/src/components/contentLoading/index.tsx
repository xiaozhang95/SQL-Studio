import { Spin } from 'antd'

export default function ContentLoading({ label }: { label: string }) {
  return (
    <div role="status" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', flex: 1, minHeight: 0 }}>
      <Spin description={label} />
    </div>
  )
}
