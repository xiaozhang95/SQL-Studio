import { fetchResponse, readJSON, request } from '../../../utils/request/index.ts'
import type { ChatEvent, TokenUsage } from '../../typings/chat'
import type { ConversationInfo } from '../../typings/workspace'
import { isObject } from '../../utils/json/index.ts'

async function json(path: string, init?: RequestInit): Promise<unknown> {
  try {
    return await request<unknown>(path, init)
  } catch (error) {
    if (error instanceof Error && error.message === 'json: unknown field "ensure"')
      throw new Error('当前运行的 Go 后端尚未更新，请停止旧进程，在 sql-studio-backend 目录重新运行 go run main.go，然后刷新页面。')
    throw error
  }
}
export async function create(signal?: AbortSignal, ensure = false): Promise<string> {
  const v = await json('/agent/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ensure ? { ensure: true } : {}),
    signal
  })
  if (!isObject(v) || typeof v.id !== 'string') throw new Error('会话响应无效')
  return v.id
}
function info(v: unknown): ConversationInfo {
  if (!isObject(v) || typeof v.id !== 'string' || typeof v.title !== 'string' || typeof v.revision !== 'number' || typeof v.updatedAt !== 'string' || typeof v.status !== 'string')
    throw new Error('会话索引无效')
  if (v.customTitle !== undefined && typeof v.customTitle !== 'boolean') throw new Error('会话索引无效')
  return {
    id: v.id,
    title: v.title,
    ...(v.customTitle !== undefined ? { customTitle: v.customTitle } : {}),
    revision: v.revision,
    status: v.status,
    updatedAt: v.updatedAt
  }
}
export async function list(signal?: AbortSignal): Promise<ConversationInfo[]> {
  const v = await json('/agent/sessions', { signal })
  if (!Array.isArray(v)) throw new Error('会话索引无效')
  return v.map(info)
}
export async function view(id: string, signal: AbortSignal): Promise<{ events: ChatEvent[]; busy: boolean }> {
  const events: ChatEvent[] = []
  let offset = 0
  let revision: number | undefined
  let eventVersion: number | undefined
  let busy = false
  while (true) {
    const suffix = offset ? `?offset=${offset}&revision=${revision}${eventVersion === undefined ? '' : `&eventVersion=${eventVersion}`}` : ''
    const v = await json(`/agent/sessions/${encodeURIComponent(id)}${suffix}`, { signal })
    signal.throwIfAborted()
    if (!isObject(v) || !Array.isArray(v.events) || typeof v.busy !== 'boolean') throw new Error('会话记录无效')
    if (revision !== undefined && revision !== v.revision) throw new Error('会话已更新，请重新打开后查看。')
    if (typeof v.revision === 'number') revision = v.revision
    if (eventVersion !== undefined && eventVersion !== v.eventVersion) throw new Error('会话已更新，请重新打开后查看。')
    if (typeof v.eventVersion === 'number') eventVersion = v.eventVersion
    busy = v.busy
    for (let i = 0; i < v.events.length; i += 256) {
      signal.throwIfAborted()
      for (const event of v.events.slice(i, i + 256)) events.push(decodeEvent(event))
      if (i + 256 < v.events.length) await new Promise<void>((resolve) => setTimeout(resolve, 0))
    }
    if (v.nextOffset === undefined) break
    if (!Number.isSafeInteger(v.nextOffset) || typeof v.nextOffset !== 'number' || v.nextOffset !== offset + v.events.length || v.nextOffset <= offset || revision === undefined)
      throw new Error('会话分页响应无效')
    offset = v.nextOffset
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
  }
  signal.throwIfAborted()
  return { events, busy }
}

export async function remove(id: string) {
  await json(`/agent/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
export async function rename(id: string, title: string): Promise<ConversationInfo> {
  return info(await json(`/agent/sessions/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }) }))
}
export async function ensureHistory(signal?: AbortSignal): Promise<ConversationInfo[]> {
  let items = await list(signal)
  if (items.length === 0) {
    await create(signal, true)
    items = await list(signal)
  }
  return items
}
const kinds = [
  'user',
  'status',
  'context',
  'model_start',
  'reasoning_delta',
  'answer_delta',
  'tool_start',
  'write_confirmation',
  'continue_confirmation',
  'tool_result',
  'answer',
  'usage',
  'error',
  'stopped',
  'turn_end',
  'done',
  'heartbeat'
] as const
export function decodeEvent(v: unknown): ChatEvent {
  if (!isObject(v) || typeof v.type !== 'string') throw new Error('事件无效')
  const kind = kinds.find((k) => k === v.type)
  if (!kind) throw new Error('未知事件')
  for (const key of ['text', 'tool', 'arguments']) if (v[key] !== undefined && typeof v[key] !== 'string') throw new Error('事件内容无效')
  let usage: TokenUsage | undefined
  if (v.usage !== undefined) {
    const u = v.usage
    if (
      !isObject(u) ||
      typeof u.promptTokens !== 'number' ||
      typeof u.completionTokens !== 'number' ||
      typeof u.window !== 'number' ||
      (u.estimatedTokens !== undefined && typeof u.estimatedTokens !== 'number')
    )
      throw new Error('用量事件无效')
    usage = {
      promptTokens: u.promptTokens,
      completionTokens: u.completionTokens,
      window: u.window,
      estimatedTokens: typeof u.estimatedTokens === 'number' ? u.estimatedTokens : undefined
    }
  }
  return {
    type: kind,
    createdAt: typeof v.createdAt === 'string' && Number.isFinite(Date.parse(v.createdAt)) ? v.createdAt : undefined,
    text: typeof v.text === 'string' ? v.text : undefined,
    tool: typeof v.tool === 'string' ? v.tool : undefined,
    arguments: typeof v.arguments === 'string' ? v.arguments : undefined,
    result: v.result,
    usage
  }
}
export async function chat(sessionId: string, message: string, signal: AbortSignal, onEvent: (e: ChatEvent) => void, mode: 'readonly' | 'write' = 'readonly') {
  const r = await fetchResponse('/agent/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, message, mode }),
    signal
  })
  if (!r.ok) await readJSON(r, signal)
  if (!r.body || !r.headers.get('Content-Type')?.includes('text/event-stream')) {
    await readJSON(r, signal)
    throw new Error('后端未返回有效的数据流，请检查服务版本。')
  }
  const reader = r.body.getReader()
  const decoder = new TextDecoder()
  let pending = ''
  let data: string[] = []
  let finished = false
  const line = (s: string) => {
    if (s.endsWith('\r')) s = s.slice(0, -1)
    if (s === '') {
      if (data.length) {
        const event = decodeEvent(JSON.parse(data.join('\n')))
        if (event.type === 'done') finished = true
        onEvent(event)
        data = []
      }
    } else if (s.startsWith('data:')) data.push(s.slice(5).replace(/^ /, ''))
  }
  try {
    while (true) {
      const part = await reader.read()
      if (part.done) break
      pending += decoder.decode(part.value, { stream: true })
      if (pending.length > 1024 * 1024) throw new Error('事件过大')
      let p: number
      while ((p = pending.indexOf('\n')) >= 0) {
        line(pending.slice(0, p))
        pending = pending.slice(p + 1)
      }
    }
    pending += decoder.decode()
    if (pending) line(pending)
    line('')
    if (!finished) throw new Error('连接中断，当前回复未完成')
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}
