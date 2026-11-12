import type { AIRequest, AIResult } from '@/typings/ai'

export const AIProvider = { DeepSeek: 'deepseek' } as const
export type AIProviderType = (typeof AIProvider)[keyof typeof AIProvider]
export const maxAIConfigurations = 64
export const aiModelsSection = 'ai-models'
export type AIModel = { id: string; name: string }
export type AIConfiguration = { id: string; provider: AIProviderType; model: string; modelName: string; configured?: boolean }
export type AIConfig = { completionEnabled?: boolean; configurations: AIConfiguration[]; activeId: string }
export interface AISettingsEntry extends AIConfiguration {
  apiKey: string
  models: AIModel[]
  modelsLoading: boolean
  modelsError: string
}
export type AIConfigDocument = { revision: number; data: AIConfig | null }
export interface AIAdapter {
  readonly profile: { readonly value: AIProviderType; readonly label: string; readonly defaultModel: string; readonly icon: string; readonly darkIcon: string }
  listModels: (apiKey: string, signal: AbortSignal, configId?: string) => Promise<AIModel[]>
  assist: (input: AIRequest, signal: AbortSignal) => Promise<AIResult>
}
