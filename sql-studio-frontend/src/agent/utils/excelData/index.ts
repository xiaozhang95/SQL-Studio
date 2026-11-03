import { isObject } from '../json'
import { readResult } from '../queryResult'

export function excelData(value: unknown): { headers: string[]; rows: unknown[][]; truncated: boolean } | null {
  if (isObject(value) && value.isQuery === false) return null
  const result = readResult(value)
  if (result) return { headers: result.columns.map((c) => c.name), rows: result.rows, truncated: result.truncated }
  if (Array.isArray(value) && value.every((v) => typeof v === 'string')) return { headers: ['名称'], rows: value.map((v) => [v]), truncated: false }
  if (Array.isArray(value) && value.length && value.every(isObject)) {
    const headers = [...new Set(value.flatMap((v) => Object.keys(v)))]
    return { headers, rows: value.map((v) => headers.map((h) => v[h] ?? null)), truncated: false }
  }
  return null
}
