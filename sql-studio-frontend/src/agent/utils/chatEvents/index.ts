import type { ChatEvent, Entry } from '../../typings/chat'
import { isObject } from '../json'

export function chatErrors(entries: Entry[]): string[] {
  const seen = new Set<string>()
  return entries
    .flatMap((entry) => {
      if (entry.role === 'error' && !entry.stopped) return [entry.text]
      if (entry.role === 'tool' && isObject(entry.result) && typeof entry.result.error === 'string') return [entry.result.error]
      return []
    })
    .filter((message) => {
      const reason = message.replace(/^本轮未完成：/, '')
      if (seen.has(reason)) return false
      seen.add(reason)
      return true
    })
}

export function applyEvent(entries: Entry[], event: ChatEvent): Entry[] {
  const next = entries.map((e) => ({ ...e }))
  accumulator(next)(event)
  return next
}

function accumulator(next: Entry[]) {
  const streaming = new Set(next.filter((entry) => entry.streaming))
  const tools = new Map<string | undefined, Entry[]>()
  for (const entry of next) {
    if (entry.role !== 'tool' || entry.result !== undefined) continue
    const pending = tools.get(entry.tool) ?? []
    pending.push(entry)
    tools.set(entry.tool, pending)
  }
  function finish(incomplete = false) {
    for (const entry of streaming) {
      entry.streaming = false
      if (incomplete) entry.incomplete = true
    }
    streaming.clear()
  }
  const last = () => next[next.length - 1]
  const add = (role: Entry['role'], text: string, extra: Partial<Entry> = {}) => {
    const entry: Entry = {
      id: (next[next.length - 1]?.id ?? 0) + 1,
      role,
      text,
      ...extra
    }
    next.push(entry)
    if (entry.streaming) streaming.add(entry)
    return entry
  }
  return (event: ChatEvent) => {
    if (event.type === 'user') add('user', event.text ?? '', { createdAt: event.createdAt })
    if (event.type === 'model_start' || event.type === 'turn_end' || event.type === 'done') finish()
    if (event.type === 'reasoning_delta' || event.type === 'answer_delta') {
      const role = event.type === 'reasoning_delta' ? 'thinking' : 'assistant'
      const prior = last()
      if (prior?.role === role && prior.streaming) prior.text += event.text ?? ''
      else add(role, event.text ?? '', { streaming: true })
    }
    if (event.type === 'tool_start') {
      finish()
      const entry = add('tool', event.arguments ?? '', { tool: event.tool })
      const pending = tools.get(event.tool) ?? []
      pending.push(entry)
      tools.set(event.tool, pending)
    }
    if (event.type === 'tool_result') {
      const pending = tools.get(event.tool)
      const entry = pending?.at(-1)
      if (entry) {
        entry.result = event.result
        if (event.result !== undefined) pending?.pop()
      }
    }
    if (event.type === 'answer') {
      const prior = last()
      if (prior?.role === 'assistant' && prior.streaming) {
        prior.text = event.text ?? ''
        prior.streaming = false
      } else add('assistant', event.text ?? '')
      finish()
    }
    if (event.type === 'error') {
      finish(true)
      add('error', `本轮未完成：${event.text ?? '请求失败'}`, {
        incomplete: true
      })
    }
    if (event.type === 'stopped') {
      finish(true)
      add('error', event.text ?? '已停止本轮', { stopped: true })
    }
  }
}

export async function restoreEvents(events: readonly ChatEvent[], signal: AbortSignal): Promise<Entry[]> {
  const entries: Entry[] = []
  const apply = accumulator(entries)
  for (let offset = 0; offset < events.length; offset += 256) {
    signal.throwIfAborted()
    for (let i = offset; i < Math.min(offset + 256, events.length); i++) apply(events[i])
    if (offset + 256 < events.length) await new Promise<void>((resolve) => setTimeout(resolve, 0))
  }
  signal.throwIfAborted()
  return entries
}
