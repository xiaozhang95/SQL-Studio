import { Alert, Spin } from 'antd'

import { useWorkspace } from '@/agent/hooks/workspace'
import { ChatPage } from '@/agent/pages/chat'
import type { ThemeMode, ThemePreference } from '@/typings/theme'

interface Props {
  themeMode: ThemeMode
  themePreference: ThemePreference
  onThemeChange: (value: ThemePreference) => void
  onBack: () => void
}
export default function AgentPage(props: Props) {
  const workspace = useWorkspace()
  if (!workspace.ready) return workspace.error ? <Alert type="error" title="无法恢复Agent记录" description={workspace.error} /> : <Spin fullscreen description="正在恢复Agent记录…" />
  return <ChatPage workspace={workspace} dark={props.themeMode === 'dark'} themePreference={props.themePreference} onThemeChange={props.onThemeChange} onBack={props.onBack} />
}
