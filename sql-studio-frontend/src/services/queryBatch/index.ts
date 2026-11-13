import type { QueryResult } from '@/typings/database'

import { fetchResponse, post, readJSON } from '../../utils/request/index.ts'

type Step = { index: number; result?: QueryResult; error?: string; database?: string }

export async function executeQueryBatch(id: string, database: string, statements: string[], signal: AbortSignal, onStep: (step: Step) => void) {
  const path = `/connections/${encodeURIComponent(id)}/query-batch`
  const response = await fetchResponse(path, { ...post({ database, statements, allowWrite: true }), headers: { 'Content-Type': 'application/json' }, signal })
  if (!response.ok) await readJSON(response, signal)
  if (!response.body || !response.headers.get('Content-Type')?.includes('application/x-ndjson')) throw new Error('后端未返回有效的 SQL 批次结果')

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  let next = 0
  let failed = false
  try {
    while (true) {
      const { done, value } = await reader.read()
      signal.throwIfAborted()
      if (done) throw new Error('SQL 批次连接提前中断')
      buffer += value
      let end: number
      while ((end = buffer.indexOf('\n')) >= 0) {
        const event = JSON.parse(buffer.slice(0, end)) as Step & { type?: string }
        buffer = buffer.slice(end + 1)
        if (event.type === 'error' && typeof event.error === 'string') throw new Error(event.error)
        if (event.type === 'done' && (failed || next === statements.length)) return
        if (event.type !== 'statement' || event.index !== next || next >= statements.length || failed || Boolean(event.result) === Boolean(event.error)) throw new Error('SQL 批次结果顺序或格式无效')
        next++
        failed = Boolean(event.error)
        onStep(event)
      }
      if (buffer.length > 64 * 1024 * 1024) throw new Error('SQL 批次结果过大')
    }
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}
