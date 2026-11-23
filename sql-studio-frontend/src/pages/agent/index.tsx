import { theme } from 'antd'

import { useWorkspace } from '@/agent/hooks/workspace'
import { ChatPage } from '@/agent/pages/chat'
import ContentLoading from '@/components/contentLoading'
import { PageErrorsProvider } from '@/components/pageErrors'
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
      <main aria-label={t('AI 助手')} style={{ height: '100%', display: 'flex', background: token.colorBgContainer }}>
        <ContentLoading label={t('正在恢复Agent记录…')} />
      </main>
    )
  return (
    <PageErrorsProvider>
      <ChatPage key={workspace.epoch} workspace={workspace} dark={themeMode === 'dark'} />
    </PageErrorsProvider>
  )
}
