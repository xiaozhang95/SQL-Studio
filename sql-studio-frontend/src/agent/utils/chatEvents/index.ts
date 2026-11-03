import type { ChatEvent, Entry } from '../../typings/chat'
import { isObject } from '../json'

export function chatErrors(entries: Entry[]): string[] {
  return [
    ...new Set(
      entries.flatMap((entry) => {
        if (entry.role === 'error') return [entry.text]
        if (entry.role === 'tool' && isObject(entry.result) && typeof entry.result.error === 'string') return [entry.result.error]
        return []
      })
    )
  ]
}

export function applyEvent(entries: Entry[], event: ChatEvent): Entry[] {
  let next = entries.map((e) => ({ ...e }))
  const last = () => next[next.length - 1]
  const add = (role: Entry['role'], text: string, extra: Partial<Entry> = {}) =>
    next.push({
      id: (next[next.length - 1]?.id ?? 0) + 1,
      role,
      text,
      ...extra
    })
  if (event.type === 'user') add('user', event.text ?? '', { createdAt: event.createdAt })
  if (event.type === 'model_start' || event.type === 'turn_end' || event.type === 'done') next = next.map((e) => ({ ...e, streaming: false }))
  if (event.type === 'reasoning_delta' || event.type === 'answer_delta') {
    const role = event.type === 'reasoning_delta' ? 'thinking' : 'assistant'
    const prior = last()
    if (prior?.role === role && prior.streaming) prior.text += event.text ?? ''
    else add(role, event.text ?? '', { streaming: true })
  }
  if (event.type === 'tool_start') {
    next = next.map((e) => ({ ...e, streaming: false }))
    add('tool', event.arguments ?? '', { tool: event.tool })
  }
  if (event.type === 'tool_result') {
    for (let i = next.length - 1; i >= 0; i--) {
      if (next[i].role === 'tool' && next[i].tool === event.tool && next[i].result === undefined) {
        next[i].result = event.result
        break
      }
    }
  }
  if (event.type === 'answer') {
    const prior = last()
    if (prior?.role === 'assistant' && prior.streaming) {
      prior.text = event.text ?? ''
      prior.streaming = false
    } else add('assistant', event.text ?? '')
    next = next.map((e) => ({ ...e, streaming: false }))
  }
  if (event.type === 'error') {
    next = next.map((e) => (e.streaming ? { ...e, streaming: false, incomplete: true } : e))
    add('error', `本轮未完成：${event.text ?? '请求失败'}`, {
      incomplete: true
    })
  }
  return next
}
