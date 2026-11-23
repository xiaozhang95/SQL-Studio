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
  children: ReactNode
  errors?: readonly (string | undefined)[]
}

/** 监控与同步共用的画布页：标题进入上下文 Header，内容铺满画布。 */
export default function DatabasePage({ title, breadcrumb, headerActions, connectionError, retryConnections, children, errors = [] }: Props) {
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
      <main style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '16px 16px 30px' }}>
        <Flex vertical gap={14} style={{ width: '100%', minWidth: 0, minHeight: '100%' }}>
          {children}
        </Flex>
      </main>
    </Flex>
  )
}