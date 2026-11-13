import { PlusOutlined } from '@ant-design/icons'
import { Button, theme } from 'antd'

import { useWorkspace } from '@/agent/hooks/workspace'
import { ChatPage } from '@/agent/pages/chat'
import ContentLoading from '@/components/contentLoading'
import PageHeader from '@/components/pageHeader'
import SectionNavigation from '@/components/sectionNavigation'
import SystemSettings from '@/components/systemSettings'
import { useTranslation } from '@/hooks/useTranslation'
import type { AppearancePreferences, ThemeMode } from '@/typings/theme'

interface Props extends AppearancePreferences {
  themeMode: ThemeMode
  onBack: () => void
  themeError?: string
}
export default function AgentPage(props: Props) {
  const { t } = useTranslation()

  const workspace = useWorkspace()
  const { token } = theme.useToken()
  const { themeMode, ...chatProps } = props
  if (!workspace.ready)
    return (
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: token.colorBgContainer }}>
        <PageHeader
          showDesktopTitle={false}
          errors={[workspace.error, props.themeError]}
          errorAction={workspace.error ? <Button onClick={workspace.retry}>{t('重试')}</Button> : undefined}
          actions={<SystemSettings {...props} />}
        >
          <Button type="text" icon={<PlusOutlined />} disabled>
            {t('新建会话')}
          </Button>
          <SectionNavigation destination="workspace" onSwitch={props.onBack} />
        </PageHeader>
        <div style={{ flex: 1, minHeight: 0 }}>{!workspace.error && <ContentLoading label={t('正在恢复Agent记录…')} />}</div>
      </div>
    )
  return <ChatPage workspace={workspace} dark={themeMode === 'dark'} {...chatProps} />
}
