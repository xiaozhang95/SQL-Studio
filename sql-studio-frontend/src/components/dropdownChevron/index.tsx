import { DownOutlined } from '@ant-design/icons'
import { theme } from 'antd'

/** 禁用时继承按钮文字色。 */
export default function DropdownChevron({ disabled = false }: { disabled?: boolean }) {
  const { token } = theme.useToken()
  return <DownOutlined aria-hidden="true" style={{ fontSize: token.fontSizeIcon, color: disabled ? undefined : token.colorIcon }} />
}
