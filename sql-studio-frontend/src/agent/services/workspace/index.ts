import type { Layout, Workspace } from '../../typings/workspace'
import { isObject } from '../../utils/json'

export async function workspace(method: 'GET' | 'PUT', input?: { revision: number; state: Layout }, signal?: AbortSignal, keepalive = false): Promise<Workspace> {
  const init: RequestInit = { method, signal, keepalive }
  if (method === 'PUT' && input) {
    init.headers = { 'Content-Type': 'application/json' }
    init.body = JSON.stringify(input)
  }
  const res = await fetch('/api/agent/workspace', init)
  const data: unknown = await res.json()
  if (!res.ok && isObject(data) && data.error === 'json: unknown field "mode"') throw new Error('当前 Go 后端尚未更新，请停止旧进程，在 sql-studio-backend 重新运行 go run main.go 后刷新页面。')
  if (!res.ok)
    throw new Error(res.status === 409 ? '另一个窗口已修改布局，自动保存已暂停。请保留草稿后刷新页面。' : isObject(data) && typeof data.error === 'string' ? data.error : '本地布局读取或保存失败')
  if (!isObject(data) || data.schemaVersion !== 1 || typeof data.revision !== 'number' || !isObject(data.state)) throw new Error('本地布局格式无效，拒绝覆盖')
  const s = data.state
  if (s.mode !== undefined && s.mode !== 'readonly' && s.mode !== 'write') throw new Error('保存的操作模式无效')
  if (typeof s.activeId !== 'string' || typeof s.draft !== 'string' || (s.expanded !== null && (!Array.isArray(s.expanded) || !s.expanded.every((v: unknown) => typeof v === 'string'))))
    throw new Error('本地布局内容无效')
  return {
    schemaVersion: 1,
    revision: data.revision,
    state: {
      mode: s.mode === 'write' ? 'write' : 'readonly',
      activeId: s.activeId,
      draft: s.draft,
      expanded: Array.isArray(s.expanded) ? s.expanded : []
    }
  }
}
