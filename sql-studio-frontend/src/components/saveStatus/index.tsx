import { LoadingOutlined } from '@ant-design/icons'
import { Tooltip } from 'antd'

import { useTranslation } from '@/hooks/useTranslation'

type Props = { saving: boolean; error?: string; label?: string }
/** 仅保存期间显示 loading，失败详情由页面错误区域展示。 */
export default function SaveStatus({ saving, error, label = '正在保存工作区…' }: Props) {
  const { t } = useTranslation()
  if (!saving || error) return null
  return (
    <Tooltip title={t(label)}>
      <span style={{ display: 'inline-flex', flex: 'none' }} role="status" aria-live="polite" aria-label={t(label)}>
        <LoadingOutlined spin />
      </span>
    </Tooltip>
  )
}
