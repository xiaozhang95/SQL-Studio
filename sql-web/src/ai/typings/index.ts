import type { AIRequest, AIResult } from '@/typings/ai'

export const AIProvider = { DeepSeek: 'deepseek' } as const
export type AIProviderType = (typeof AIProvider)[keyof typeof AIProvider]
export type AIModel = { id: string; name: string }
export type AIConfig = { provider: AIProviderType; model?: string; configured?: boolean; completionEnabled?: boolean }
export type AIConfigDocument = { revision: number; data: AIConfig | null }
export interface AIAdapter {
  readonly profile: { readonly value: AIProviderType; readonly label: string; readonly defaultModel: string; readonly icon: string; readonly darkIcon: string }
  listModels: (apiKey: string, signal: AbortSignal) => Promise<AIModel[]>
  assist: (input: AIRequest, signal: AbortSignal) => Promise<AIResult>
}
