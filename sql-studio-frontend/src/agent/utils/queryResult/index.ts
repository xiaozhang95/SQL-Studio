import { isObject } from '../json'

export interface ResultColumn {
  name: string
  type: string
}
export interface ResultData {
  columns: ResultColumn[]
  rows: unknown[][]
  durationMs: number
  truncated: boolean
}
export function readResult(value: unknown): ResultData | null {
  if (!isObject(value) || !Array.isArray(value.columns) || !Array.isArray(value.rows)) return null
  const columns: ResultColumn[] = []
  for (const c of value.columns) {
    if (!isObject(c) || typeof c.name !== 'string' || typeof c.type !== 'string') return null
    columns.push({ name: c.name, type: c.type })
  }
  const rows: unknown[][] = []
  for (const row of value.rows) {
    if (!Array.isArray(row) || row.length !== columns.length) return null
    rows.push(row)
  }
  return {
    columns,
    rows,
    durationMs: typeof value.durationMs === 'number' ? value.durationMs : 0,
    truncated: value.truncated === true
  }
}
export function cellText(value: unknown): string {
  if (value === null) return 'NULL'
  if (value === '') return '空字符串'
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}
export function readSQL(input?: string): string {
  if (!input) return ''
  try {
    const v: unknown = JSON.parse(input)
    return isObject(v) && typeof v.sql === 'string' ? v.sql : ''
  } catch {
    return ''
  }
}
