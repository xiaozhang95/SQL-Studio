import { Flex, Grid, theme, Typography } from 'antd'
import type { ReactNode } from 'react'

import ErrorNotice from '@/components/errorNotice'
import { usePageErrors } from '@/contexts/pageErrors'

interface Props {
  children?: ReactNode
  actions: ReactNode
  title?: ReactNode
  breadcrumb?: ReactNode
  errors?: readonly (string | undefined)[]
  errorAction?: ReactNode
  onErrorClose?: () => void
  errorScope?: string
}

/** 页面上下文 Header：标题、面包屑和当前页面操作，全局导航由 AppRail 承载。 */
export default function PageHeader({ children, actions, title, breadcrumb, errors = [], errorAction, onErrorClose, errorScope }: Props) {
  const screens = Grid.useBreakpoint()
  const { token } = theme.useToken()
  const pageErrors = usePageErrors()
  return (
    <>
      <header
        className="context-header"
        style={{
          minHeight: 48,
          flex: 'none',
          paddingInline: token.padding,
          paddingBlock: token.paddingXXS,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: token.marginXS,
          background: token.colorBgContainer,
          borderBlockEnd: `${token.lineWidth}px solid ${token.colorBorderSecondary}`,
          userSelect: 'none',
          position: 'relative'
        }}
      >
        <Flex align="center" gap={token.marginSM} style={{ minWidth: 0, flex: '0 1 auto' }}>
          {title && (
            <Typography.Text strong ellipsis={{ tooltip: typeof title === 'string' ? title : undefined }} style={{ minWidth: 0 }}>
              {title}
            </Typography.Text>
          )}
          {breadcrumb && screens.xl && (
            <Typography.Text type="secondary" ellipsis={{ tooltip: typeof breadcrumb === 'string' ? breadcrumb : undefined }} style={{ minWidth: 0 }}>
              {breadcrumb}
            </Typography.Text>
          )}
          {children}
        </Flex>
        <Flex align="center" gap={token.marginXS} wrap style={{ flex: '0 1 auto', minWidth: 0, marginInlineStart: 'auto' }}>
          {actions}
        </Flex>
      </header>
      <div style={{ flexShrink: 0, maxHeight: '25dvh', overflowY: 'auto' }}>
        <ErrorNotice
          key={errorScope}
          banner
          errors={[...errors, ...(pageErrors?.errors ?? [])]}
          action={errorAction}
          onClose={() => {
            pageErrors?.clearErrors()
            onErrorClose?.()
          }}
        />
      </div>
    </>
  )
}
