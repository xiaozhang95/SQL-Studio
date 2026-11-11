import { Button, Tooltip } from 'antd'
import type { ButtonProps, GetRef } from 'antd'
import { forwardRef } from 'react'

interface Props extends Omit<ButtonProps, 'children' | 'type' | 'title' | 'aria-label'> {
  label: string
  hint?: string
  icon: NonNullable<ButtonProps['icon']>
}

/** 工作区操作共用图标按钮，禁用时仍可查看说明。 */
const ToolbarButton = forwardRef<GetRef<typeof Button>, Props>(function ToolbarButton({ label, hint, ...props }, ref) {
  return (
    <Tooltip title={hint ?? label}>
      <span style={{ display: 'inline-flex' }}>
        <Button {...props} ref={ref} type="text" aria-label={label} />
      </span>
    </Tooltip>
  )
})

export default ToolbarButton
