import { readResult } from '../queryResult'
import type { ResultData } from '../queryResult'

export type AnswerPart = { kind: 'text'; text: string } | { kind: 'table'; value: ResultData } | { kind: 'code'; language: string; text: string } | { kind: 'pending-table'; text: string }

/** Match the complete outer object without treating braces in JSON strings as delimiters. */
function objectEnd(text: string, start: number): number {
  let depth = 0
  let quoted = false
  let escaped = false
  for (let i = start; i < text.length; i++) {
    const char = text[i]
    if (quoted) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') quoted = false
    } else if (char === '"') quoted = true
    else if (char === '{') depth++
    else if (char === '}' && --depth === 0) return i + 1
  }
  return -1
}

function readTable(text: string): ResultData | null {
  try {
    return readResult(JSON.parse(text))
  } catch {
    return null
  }
}

function tablePrefix(text: string): boolean {
  return /^\{\s*"(?:columns|rows)"\s*:/.test(text)
}

/** Only validated result objects become tables; ordinary JSON and inline code stay intact. */
function textParts(text: string): AnswerPart[] {
  const parts: AnswerPart[] = []
  let start = 0
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '`') {
      const ticks = text.slice(i).match(/^`+/)?.[0] ?? '`'
      const end = text.indexOf(ticks, i + ticks.length)
      if (end < 0) break
      i = end + ticks.length - 1
      continue
    }
    if (text[i] !== '{') continue
    const end = objectEnd(text, i)
    if (end < 0) {
      if (tablePrefix(text.slice(i))) {
        if (i > start) parts.push({ kind: 'text', text: text.slice(start, i) })
        parts.push({ kind: 'pending-table', text: text.slice(i) })
        start = text.length
      }
      break
    }
    const value = readTable(text.slice(i, end))
    if (value) {
      if (i > start) parts.push({ kind: 'text', text: text.slice(start, i) })
      parts.push({ kind: 'table', value })
      start = end
    }
    i = end - 1
  }
  if (start < text.length) parts.push({ kind: 'text', text: text.slice(start) })
  return parts
}
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
      parts.push(...textParts(plain.join('\n')))
      plain = []
    }
  }
  for (let i = 0; i < lines.length; i++) {
    const fence = lines[i].match(/^\s*(`{3,}|~{3,})([^`~]*)$/)
    if (fence) {
      const marker = fence[1]
      const language = fence[2].trim().toLowerCase()
      const closes = (line: string) => {
        const candidate = line.trim()
        return candidate.length >= marker.length && [...candidate].every((char) => char === marker[0])
      }
      let end = i + 1
      while (end < lines.length && !closes(lines[end])) end++
      const content = lines.slice(i + 1, end).join('\n')
      const tableFormat = language === 'json' || language === ''
      const value = tableFormat ? readTable(content) : null
      flush()
      if (value) parts.push({ kind: 'table', value })
      else if (tableFormat && end === lines.length && tablePrefix(content.trimStart())) parts.push({ kind: 'pending-table', text: content })
      else parts.push({ kind: 'code', language, text: content })
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
