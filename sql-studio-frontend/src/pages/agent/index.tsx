import { Alert, theme } from 'antd'

import { useWorkspace } from '@/agent/hooks/workspace'
import { ChatPage } from '@/agent/pages/chat'
import ContentLoading from '@/components/contentLoading'
import type { ThemeMode, ThemePreference } from '@/typings/theme'

interface Props {
  themeMode: ThemeMode
  themePreference: ThemePreference
  onThemeChange: (value: ThemePreference) => void
  onBack: () => void
}
export default function AgentPage(props: Props) {
  const workspace = useWorkspace()
  const { token } = theme.useToken()
  if (!workspace.ready)
    return workspace.error ? (
      <Alert type="error" title="无法恢复Agent记录" description={workspace.error} />
    ) : (
      <div style={{ height: '100dvh', background: token.colorBgContainer }}>
        <ContentLoading label="正在恢复Agent记录…" />
      </div>
    )
  return <ChatPage workspace={workspace} dark={props.themeMode === 'dark'} themePreference={props.themePreference} onThemeChange={props.onThemeChange} onBack={props.onBack} />
}
