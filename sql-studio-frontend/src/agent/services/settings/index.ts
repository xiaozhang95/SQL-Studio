import type { AIStatus, AIUpdate } from '../../typings/settings'
import { isObject } from '../../utils/json'

export async function settings(method: 'GET' | 'PUT' | 'DELETE', input?: AIUpdate, signal?: AbortSignal): Promise<AIStatus> {
  const options: RequestInit = { method, signal }
  if (method === 'PUT' && input) {
    options.headers = { 'Content-Type': 'application/json' }
    options.body = JSON.stringify(input)
  }
  const res = await fetch('/api/agent/settings', options)
  const data: unknown = await res.json()
  if (!res.ok) throw new Error(isObject(data) && typeof data.error === 'string' ? data.error : '模型配置请求失败')
  if (!isObject(data) || typeof data.configured !== 'boolean' || typeof data.model !== 'string' || (data.source !== 'saved' && data.source !== 'environment' && data.source !== 'none'))
    throw new Error('模型配置响应无效')
  if (!Array.isArray(data.models)) throw new Error('模型列表响应无效')
  const models = data.models.map((v: unknown) => {
    if (!isObject(v) || typeof v.id !== 'string' || typeof v.name !== 'string') throw new Error('模型列表无效')
    return { id: v.id, name: v.name }
  })
  return {
    configured: data.configured,
    model: data.model,
    source: data.source,
    models
  }
}
