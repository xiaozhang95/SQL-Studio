import type { QueryResult } from '@/typings/database'

import { fetchResponse, readJSON } from '../../utils/request/index.ts'

function readEvent(text: string): { type: 'rows'; result: QueryResult } | { type: 'done' } | { type: 'error'; error: string } {
  const value: unknown = JSON.parse(text)
  if (!value || typeof value !== 'object' || !('type' in value)) throw new Error('导出事件格式错误')
  if (value.type === 'done') return { type: 'done' }
  if (value.type === 'error' && 'error' in value && typeof value.error === 'string') return { type: 'error', error: value.error }
  if (value.type !== 'rows' || !('result' in value) || !value.result || typeof value.result !== 'object') throw new Error('导出数据格式错误')
  const result = value.result
  if (
    !('columns' in result) ||
    !Array.isArray(result.columns) ||
    !result.columns.every((column: unknown) => column && typeof column === 'object' && 'name' in column && typeof column.name === 'string' && 'type' in column && typeof column.type === 'string')
  )
    throw new Error('导出列格式错误')
  const columnCount = result.columns.length
  if (
    !('rows' in result) ||
    !Array.isArray(result.rows) ||
    !result.rows.every((row: unknown) => Array.isArray(row) && row.length === columnCount && row.every((cell: unknown) => cell === null || ['string', 'number', 'boolean'].includes(typeof cell))) ||
    !('rowCount' in result) ||
    result.rowCount !== result.rows.length ||
    !('truncated' in result) ||
    result.truncated !== false
  )
    throw new Error('导出数据不完整')
  return { type: 'rows', result: result as QueryResult }
}

/** POST-free SSE read, awaited callbacks provide file-write backpressure. */
export async function streamTableData(id: string, database: string, table: string, onRows: (result: QueryResult) => Promise<void>, signal: AbortSignal) {
  const response = await fetchResponse(`/connections/${encodeURIComponent(id)}/export-data?${new URLSearchParams({ database, table })}`, { signal, headers: { Accept: 'text/event-stream' } })
  if (!response.ok) await readJSON(response, signal)
  if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream')) {
    await readJSON(response, signal)
    throw new Error('后端未返回有效的数据流，请检查服务版本。')
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = '',
    completed = false
  try {
    while (true) {
      const { value, done } = await reader.read()
      buffer += decoder.decode(value, { stream: !done }).replaceAll('\r\n', '\n')
      let end: number
      while ((end = buffer.indexOf('\n\n')) >= 0) {
        const frame = buffer.slice(0, end)
        buffer = buffer.slice(end + 2)
        const data = frame
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trimStart())
          .join('\n')
        if (!data) continue
        const event = readEvent(data)
        if (event.type === 'error') throw new Error(event.error)
        if (event.type === 'done') {
          completed = true
          return
        }
        await onRows(event.result)
      }
      if (buffer.length > 64 * 1024 * 1024) throw new Error('导出事件过大')
      if (done) break
    }
    if (!completed) throw new Error('导出连接提前中断，文件未完成')
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}
