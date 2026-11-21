import { PlusOutlined } from '@ant-design/icons'
import { Button, theme } from 'antd'

import { useWorkspace } from '@/agent/hooks/workspace'
import { ChatPage } from '@/agent/pages/chat'
import ContentLoading from '@/components/contentLoading'
import { PageErrorsProvider } from '@/components/pageErrors'
import PageHeader from '@/components/pageHeader'
import { useTranslation } from '@/hooks/useTranslation'
import type { ThemeMode } from '@/typings/theme'

interface Props {
  themeMode: ThemeMode
}
export default function AgentPage({ themeMode }: Props) {
  const { t } = useTranslation()

  const workspace = useWorkspace()
  const { token } = theme.useToken()
  if (!workspace.ready)
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: token.colorBgContainer }}>
        <PageHeader
          title={t('AI 助手')}
          actions={
            <Button icon={<PlusOutlined />} disabled>
              {t('新建会话')}
            </Button>
          }
        />
        <div style={{ flex: 1, minHeight: 0 }}>
          <ContentLoading label={t('正在恢复Agent记录…')} />
        </div>
      </div>
    )
  return (
    <PageErrorsProvider>
      <ChatPage key={workspace.epoch} workspace={workspace} dark={themeMode === 'dark'} />
    </PageErrorsProvider>
  )
}
