import { LoadingOutlined } from '@ant-design/icons'
import { Tooltip } from 'antd'

type Props = { saving: boolean; error?: string; label?: string }
/** 仅保存期间显示 loading，失败详情由页面错误区域展示。 */
export default function SaveStatus({ saving, error, label = '正在保存工作区…' }: Props) {
  if (!saving || error) return null
  return (
    <Tooltip title={label}>
      <span style={{ display: 'inline-flex', flex: 'none' }} role="status" aria-live="polite" aria-label={label}>
        <LoadingOutlined spin />
      </span>
    </Tooltip>
  )
}
