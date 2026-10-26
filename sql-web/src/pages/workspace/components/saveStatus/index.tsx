import { CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined } from '@ant-design/icons'
import { Space, theme, Tooltip, Typography } from 'antd'

type Props = { restoring: boolean; saving: boolean; error?: string }
/** 状态使用原生语义色；错误优先，不将失败显示为保存成功。 */
export default function SaveStatus({ restoring, saving, error }: Props) {
  const { token } = theme.useToken()
  const loading = !error && (restoring || saving)
  const text = error ? '保存失败' : restoring ? '正在恢复…' : saving ? '正在保存…' : '已保存到本机'
  const color = error ? token.colorError : loading ? token.colorInfo : token.colorSuccess
  return (
    <Tooltip title={error || (loading ? '正在同步本机配置' : '当前工作区配置已保存到本机')}>
      <Space size={6} style={{ color }} role="status" aria-live="polite" aria-label="工作区保存状态">
        {error ? <CloseCircleOutlined /> : loading ? <LoadingOutlined spin /> : <CheckCircleOutlined />}
        <Typography.Text style={{ color: 'inherit' }}>{text}</Typography.Text>
      </Space>
    </Tooltip>
  )
}
