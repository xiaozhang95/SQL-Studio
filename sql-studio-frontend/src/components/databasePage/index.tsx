import { Button, Flex, theme, Typography } from 'antd'
import type { ReactNode } from 'react'

import PageHeader from '@/components/pageHeader'
import SectionNavigation from '@/components/sectionNavigation'
import SystemSettings from '@/components/systemSettings'
import { useTranslation } from '@/hooks/useTranslation'
import type { AppearancePreferences } from '@/typings/theme'

export type DatabasePageProps = AppearancePreferences & {
  onBack: () => void
  connectionError?: string
  retryConnections: () => void
}

interface Props extends DatabasePageProps {
  title: string
  backDisabled?: boolean
  children: ReactNode
}

export default function DatabasePage({ title, onBack, connectionError, retryConnections, backDisabled, children, ...appearance }: Props) {
  const { t } = useTranslation()
  const { token } = theme.useToken()
  return (
    <Flex vertical style={{ height: '100dvh', minWidth: 0, color: token.colorText, background: token.colorBgLayout }}>
      <PageHeader
        desktopTitle={title}
        actions={<SystemSettings {...appearance} />}
        errors={[connectionError]}
        errorAction={connectionError ? <Button onClick={retryConnections}>{t('重试')}</Button> : undefined}
      >
        <SectionNavigation destination="workspace" onSwitch={onBack} switchDisabled={backDisabled} separated={false} />
      </PageHeader>
      <main style={{ flex: 1, minHeight: 0, overflow: 'auto', paddingBlock: token.paddingLG, paddingInline: `clamp(${token.padding}px, 3vw, ${token.paddingXL}px)` }}>
        <Flex vertical gap="large" style={{ minWidth: 0 }}>
          <Typography.Title level={2} style={{ margin: 0 }}>
            {title}
          </Typography.Title>
          {children}
        </Flex>
      </main>
    </Flex>
  )
}
