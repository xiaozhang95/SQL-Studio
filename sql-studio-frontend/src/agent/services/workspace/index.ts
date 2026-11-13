import { request, RequestError } from '@/utils/request'

import type { Layout, Workspace } from '../../typings/workspace'
import { isObject } from '../../utils/json'

export async function workspace(method: 'GET' | 'PUT', input?: { revision: number; state: Layout }, signal?: AbortSignal, keepalive = false): Promise<Workspace> {
  const init: RequestInit = { method, signal, keepalive }
  if (method === 'PUT' && input) {
    init.headers = { 'Content-Type': 'application/json' }
    init.body = JSON.stringify(input)
  }
  const data = await request<unknown>('/agent/workspace', init).catch((error: unknown) => {
    if (error instanceof RequestError && error.status === 409) throw new Error('另一个窗口已修改布局，自动保存已暂停。请保留草稿后刷新页面。')
    throw error
  })
  if (!isObject(data) || data.schemaVersion !== 1 || typeof data.revision !== 'number' || !isObject(data.state)) throw new Error('本地布局格式无效，拒绝覆盖')
  const s = data.state
  if (s.mode !== 'readonly' && s.mode !== 'write') throw new Error('保存的操作模式无效')
  if (typeof s.activeId !== 'string' || typeof s.draft !== 'string' || !Array.isArray(s.expanded) || !s.expanded.every((v: unknown) => typeof v === 'string')) throw new Error('本地布局内容无效')
  return {
    schemaVersion: 1,
    revision: data.revision,
    state: {
      mode: s.mode,
      activeId: s.activeId,
      draft: s.draft,
      expanded: s.expanded
    }
  }
}
