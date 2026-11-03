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

// A mounted Agent must observe changes made by the shared workspace configuration.
export function observeSettings(onStatus: (value: AIStatus) => void, onError: (error: Error) => void) {
  let current: AbortController | undefined
  let disposed = false
  function refresh() {
    current?.abort()
    const controller = new AbortController()
    current = controller
    void settings('GET', undefined, controller.signal)
      .then((value) => {
        if (!disposed && !controller.signal.aborted) onStatus(value)
      })
      .catch((error: unknown) => {
        if (!disposed && !controller.signal.aborted) onError(error instanceof Error ? error : new Error('读取共享AI配置失败'))
      })
  }
  function visible() {
    if (document.visibilityState === 'visible') refresh()
  }
  window.addEventListener('ai-settings-saved', refresh)
  window.addEventListener('focus', refresh)
  document.addEventListener('visibilitychange', visible)
  refresh()
  return () => {
    disposed = true
    current?.abort()
    window.removeEventListener('ai-settings-saved', refresh)
    window.removeEventListener('focus', refresh)
    document.removeEventListener('visibilitychange', visible)
  }
}
