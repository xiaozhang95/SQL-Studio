import { Button, Flex, theme } from 'antd'
import type { ReactNode } from 'react'

import PageErrorBanner from '@/components/pageErrorBanner'
import { useTranslation } from '@/hooks/useTranslation'

export type DatabasePageProps = {
  onBack?: () => void
  connectionError?: string
  retryConnections: () => void
}

interface Props extends DatabasePageProps {
  title: string
  children: ReactNode
  errors?: readonly (string | undefined)[]
}

/** 监控与同步共用的页面布局，底色与工作台及 AI 助手一致。 */
export default function DatabasePage({ title, connectionError, retryConnections, children, errors = [] }: Props) {
  const { t } = useTranslation()
  const { token } = theme.useToken()
  return (
    <Flex vertical style={{ height: '100%', minWidth: 0, color: token.colorText, background: token.colorBgContainer }}>
      <PageErrorBanner
        errors={[connectionError, ...errors]}
        errorAction={connectionError ? <Button onClick={retryConnections}>{t('重试')}</Button> : undefined}
      />
      <main aria-label={title} style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '16px 16px 30px' }}>
        <Flex vertical gap={14} style={{ width: '100%', minWidth: 0, minHeight: '100%' }}>
          {children}
        </Flex>
      </main>
    </Flex>
  )
}
