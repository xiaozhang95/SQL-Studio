import { Button, Flex, theme } from 'antd'
import type { ReactNode } from 'react'

import PageHeader from '@/components/pageHeader'
import { useTranslation } from '@/hooks/useTranslation'

export type DatabasePageProps = {
  onBack?: () => void
  connectionError?: string
  retryConnections: () => void
}

interface Props extends DatabasePageProps {
  title: string
  breadcrumb?: ReactNode
  headerActions?: ReactNode
  contentWidth?: number
  children: ReactNode
  errors?: readonly (string | undefined)[]
}

/** 监控与同步共用的画布页：标题进入上下文 Header，内容在画布上居中滚动。 */
export default function DatabasePage({ title, breadcrumb, headerActions, contentWidth = 1380, connectionError, retryConnections, children, errors = [] }: Props) {
  const { t } = useTranslation()
  const { token } = theme.useToken()
  return (
    <Flex vertical style={{ height: '100%', minWidth: 0, color: token.colorText, background: token.colorBgLayout }}>
      <PageHeader
        title={title}
        breadcrumb={breadcrumb}
        actions={headerActions}
        errors={[connectionError, ...errors]}
        errorAction={connectionError ? <Button onClick={retryConnections}>{t('重试')}</Button> : undefined}
      />
      <main style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '18px 22px 30px' }}>
        <Flex vertical gap={token.marginMD} style={{ width: '100%', maxWidth: contentWidth, margin: '0 auto', minWidth: 0 }}>
          {children}
        </Flex>
      </main>
    </Flex>
  )
}