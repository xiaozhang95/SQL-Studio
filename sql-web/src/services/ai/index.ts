import type { AIModel, AIProviderType } from '@/ai/typings'
import type { AIRequest, AIResult } from '@/typings/ai'
import { request } from '@/utils/request'

export async function assistSQL(input: AIRequest, signal: AbortSignal): Promise<AIResult> {
  const result = await request<AIResult>('/ai/assist', { method: 'POST', body: JSON.stringify(input), signal })
  if (
    !result ||
    (input.action === 'complete' ? typeof result.completion !== 'string' && result.completion !== undefined : typeof result.sql !== 'string' || !result.sql.trim()) ||
    (result.explanation !== undefined && typeof result.explanation !== 'string')
  )
    throw new Error('AI 返回内容无效')
  return result
}

export async function listAIModels(provider: AIProviderType, apiKey: string, signal: AbortSignal): Promise<AIModel[]> {
  const models = await request<AIModel[]>('/ai/models', { method: 'POST', body: JSON.stringify({ provider, apiKey }), signal })
  if (!Array.isArray(models) || !models.length || models.some((model) => !model || typeof model.id !== 'string' || !model.id || typeof model.name !== 'string')) throw new Error('模型列表响应无效')
  return models
}
