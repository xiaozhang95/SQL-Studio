import type { QueryResult } from '@/typings/database'
import { fetchResponse, post, readJSON, request } from '@/utils/request'

export type RedisKey = { name: string; ref: string }
export type RedisKeyPage = { keys: RedisKey[]; cursor: string }
export type RedisKeyDetail = { name?: string; type: string; ttlMillis: number; size: number; preview: string; truncated: boolean; editable: boolean }
export type RedisKeyChange =
  | { action: 'delete' }
  | { action: 'copy'; target: string }
  | { action: 'rename'; target: string; ttl?: number }
  | { action: 'value'; valueType?: string; target?: string; value: string; before: string; ttl?: number }
  | { action: 'create'; target: string; value: string; ttl: number }
  | { action: 'ttl'; ttl: number }
export type RedisReply = { database: number; output: string; truncated: boolean; result?: QueryResult }
export type RedisChannel = { name: string; ref: string; subscribers: number }
export type RedisChannels = { channels: RedisChannel[]; patterns: number; truncated: boolean }
export type RedisEvent = { type: 'ready' } | { type: 'message'; channel: string; payload: string; truncated?: boolean }

const path = (id: string) => `/connections/${encodeURIComponent(id)}/redis`

export const scanKeys = (id: string, database: number, pattern: string, cursor: string, signal: AbortSignal) =>
  request<RedisKeyPage>(`${path(id)}/keys?${new URLSearchParams({ database: String(database), cursor, pattern })}`, { signal })

export const getKey = (id: string, database: number, ref: string, signal: AbortSignal) => request<RedisKeyDetail>(`${path(id)}/key`, { ...post({ database: String(database), ref }), signal })

export const getKeyTTL = (id: string, database: number, ref: string, signal: AbortSignal) =>
  request<{ ttlMillis: number }>(`${path(id)}/key/ttl`, { ...post({ database: String(database), ref }), signal })

export const changeKey = (id: string, database: number, ref: string | undefined, change: RedisKeyChange, signal: AbortSignal) =>
  request<{ ok: boolean; key?: RedisKey }>(`${path(id)}/key/change`, { ...post({ database: String(database), ref, ...change }), signal })

export const runCommand = (id: string, database: number, command: string, signal: AbortSignal) =>
  request<RedisReply>(`${path(id)}/command`, { ...post({ database: String(database), command }), signal })

export const getChannels = (id: string, pattern: string, signal: AbortSignal) => request<RedisChannels>(`${path(id)}/channels?${new URLSearchParams({ pattern })}`, { signal })

export async function subscribe(id: string, channel: string, pattern: boolean, signal: AbortSignal, onEvent: (event: RedisEvent) => void) {
  const response = await fetchResponse(`${path(id)}/subscribe`, { ...post({ channel, pattern }), signal, headers: { 'Content-Type': 'application/json' } })
  if (!response.ok) await readJSON(response, signal)
  if (!response.body || !response.headers.get('Content-Type')?.includes('application/x-ndjson')) throw new Error('Redis 订阅响应无效')
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  try {
    while (!signal.aborted) {
      const { value, done } = await reader.read()
      signal.throwIfAborted()
      if (done) throw new Error('Redis 订阅已断开')
      buffer += value
      let end = buffer.indexOf('\n')
      while (end >= 0) {
        if (end > 128 * 1024) throw new Error('Redis 订阅响应无效')
        const event = JSON.parse(buffer.slice(0, end))
        buffer = buffer.slice(end + 1)
        if (event?.type === 'error' && typeof event.payload === 'string') throw new Error(event.payload)
        if (event?.type === 'ready') onEvent({ type: 'ready' })
        else if (event?.type === 'message' && typeof event.channel === 'string' && typeof event.payload === 'string') {
          onEvent({ type: 'message', channel: event.channel, payload: event.payload, truncated: event.truncated === true })
        } else if (event?.type !== 'heartbeat') throw new Error('Redis 订阅响应无效')
        end = buffer.indexOf('\n')
      }
      if (buffer.length > 128 * 1024) throw new Error('Redis 订阅响应无效')
    }
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}
