import { getAIAdapter } from '@/ai'
import type { AIProviderType } from '@/ai/typings'

export default function AIProviderIcon({ provider, size, className }: { provider: AIProviderType; size?: number; className?: string }) {
  const profile = getAIAdapter(provider).profile
  return <img className={className} src={profile.icon} alt="" aria-hidden="true" width={size ?? 22} height={size ?? 18} style={{ display: 'block', objectFit: 'contain', flexShrink: 0 }} />
}
