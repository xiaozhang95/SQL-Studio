import { assistSQL, listAIModels } from '@/services/ai'

import { AIProvider } from '../../typings'
import type { AIAdapter } from '../../typings'

export const deepseekAPI = {
  listModels: (apiKey, signal) => listAIModels(AIProvider.DeepSeek, apiKey, signal),
  assist: assistSQL
} satisfies Pick<AIAdapter, 'listModels' | 'assist'>
