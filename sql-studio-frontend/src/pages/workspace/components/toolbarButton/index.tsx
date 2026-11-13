import { Button, Tooltip } from 'antd'
import type { ButtonProps, GetRef } from 'antd'
import { forwardRef } from 'react'

import { useTranslation } from '@/hooks/useTranslation'

interface Props extends Omit<ButtonProps, 'children' | 'type' | 'title' | 'aria-label'> {
  label: string
  hint?: string
  icon: NonNullable<ButtonProps['icon']>
}

/** 工作区操作共用图标按钮，禁用时仍可查看说明。 */
const ToolbarButton = forwardRef<GetRef<typeof Button>, Props>(function ToolbarButton({ label, hint, ...props }, ref) {
  const { t } = useTranslation()
  return (
    <Tooltip title={t(hint ?? label)}>
      <span style={{ display: 'inline-flex' }}>
        <Button {...props} ref={ref} type="text" aria-label={t(label)} />
      </span>
    </Tooltip>
  )
})

export default ToolbarButton
