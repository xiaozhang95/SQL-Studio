import deepseek from './deepseek'
import { AIProvider } from './typings'
import type { AIAdapter, AIProviderType } from './typings'

const adapters = { [AIProvider.DeepSeek]: deepseek } satisfies Record<AIProviderType, AIAdapter>
export const aiProviders: readonly AIAdapter['profile'][] = Object.values(adapters).map((adapter) => adapter.profile)
export const getAIAdapter = (provider: AIProviderType = AIProvider.DeepSeek): AIAdapter => adapters[provider]
export const isAIProvider = (value: unknown): value is AIProviderType => typeof value === 'string' && Object.hasOwn(adapters, value)
