import { readResult } from '../queryResult'
import type { ResultData } from '../queryResult'

export type AnswerPart = { kind: 'text'; text: string } | { kind: 'table'; value: ResultData } | { kind: 'code'; language: string; text: string }
function cells(line: string): string[] {
  let text = line.trim()
  if (text.startsWith('|')) text = text.slice(1)
  if (text.endsWith('|') && !text.endsWith('\\|')) text = text.slice(0, -1)
  return text.split(/(?<!\\)\|/).map((cell) =>
    cell
      .trim()
      .replace(/\\\|/g, '|')
      .replace(/^`([^`]*)`$/, '$1')
  )
}
export function answerTables(text: string): AnswerPart[] {
  const lines = text.split('\n')
  const parts: AnswerPart[] = []
  let plain: string[] = []
  const flush = () => {
    if (plain.length) {
      parts.push({ kind: 'text', text: plain.join('\n') })
      plain = []
    }
  }
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*```/.test(lines[i])) {
      let end = i + 1
      while (end < lines.length && !/^\s*```/.test(lines[end])) end++
      if (end < lines.length && /^\s*```json\s*$/i.test(lines[i])) {
        try {
          const value = readResult(JSON.parse(lines.slice(i + 1, end).join('\n')))
          if (value) {
            flush()
            parts.push({ kind: 'table', value })
            i = end
            continue
          }
        } catch {
          /* Preserve malformed content as text. */
        }
      }
      flush()
      parts.push({ kind: 'code', language: lines[i].trim().slice(3).trim().toLowerCase(), text: lines.slice(i + 1, end).join('\n') })
      i = end
      continue
    }
    const header = cells(lines[i])
    const divider = i + 1 < lines.length ? cells(lines[i + 1]) : []
    if (lines[i].includes('|') && header.length > 0 && divider.length === header.length && divider.every((v) => /^:?-{3,}:?$/.test(v))) {
      const rows: string[][] = []
      let end = i + 2
      while (end < lines.length && lines[end].includes('|')) {
        const row = cells(lines[end])
        if (row.length !== header.length) break
        rows.push(row)
        end++
      }
      flush()
      parts.push({ kind: 'table', value: { columns: header.map((name) => ({ name, type: 'text' })), rows, durationMs: 0, truncated: false } })
      i = end - 1
      continue
    }
    plain.push(lines[i])
  }
  flush()
  return parts
}
