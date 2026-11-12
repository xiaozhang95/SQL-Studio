import { DownOutlined } from '@ant-design/icons'

/** 禁用时继承按钮文字色。 */
export default function DropdownChevron({ disabled = false }: { disabled?: boolean }) {
  return <DownOutlined aria-hidden="true" style={{ fontSize: 'var(--ant-font-size-icon)', color: disabled ? 'inherit' : 'var(--ant-color-icon)' }} />
}
