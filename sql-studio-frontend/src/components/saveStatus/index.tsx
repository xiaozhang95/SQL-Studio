import { CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined } from '@ant-design/icons'
import { Space, Tooltip, Typography } from 'antd'

type Props = { restoring: boolean; saving: boolean; error?: string; label?: string; savedText?: string; savedHint?: string }
/** 状态使用原生语义色；错误优先，不将失败显示为保存成功。 */
export default function SaveStatus({ restoring, saving, error, label = '工作区保存状态', savedText = '已保存到本机', savedHint = '当前工作区配置已保存到本机' }: Props) {
  const loading = !error && (restoring || saving)
  const text = error ? '保存失败' : restoring ? '正在恢复…' : saving ? '正在保存…' : savedText
  return (
    <Tooltip title={error || (loading ? '正在同步本机配置' : savedHint)}>
      <Space
        size={6}
        className="save-status"
        style={{ color: error ? 'var(--ant-color-error)' : loading ? 'var(--ant-color-info)' : 'var(--ant-color-success)' }}
        role="status"
        aria-live="polite"
        aria-label={label}
      >
        {error ? <CloseCircleOutlined /> : loading ? <LoadingOutlined spin /> : <CheckCircleOutlined />}
        <Typography.Text>{text}</Typography.Text>
      </Space>
    </Tooltip>
  )
}
