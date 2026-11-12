import { AIProvider } from '@/ai/typings'
import AIProviderIcon from '@/components/aiProviderIcon'

export function DeepSeekLogo({ size = 24, className }: { size?: number; className?: string }) {
  return <AIProviderIcon provider={AIProvider.DeepSeek} size={size} className={className} />
}
