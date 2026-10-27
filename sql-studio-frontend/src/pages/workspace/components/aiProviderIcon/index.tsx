import { getAIAdapter } from '@/ai'
import type { AIProviderType } from '@/ai/typings'
import type { ThemeMode } from '@/typings/theme'

export default function AIProviderIcon({ provider, themeMode }: { provider: AIProviderType; themeMode: ThemeMode }) {
  const profile = getAIAdapter(provider).profile
  return <img src={themeMode === 'dark' ? profile.darkIcon : profile.icon} alt="" aria-hidden="true" style={{ width: 22, height: 18, objectFit: 'contain', flexShrink: 0 }} />
}
