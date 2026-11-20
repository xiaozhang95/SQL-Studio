import { downloadBlob } from '../downloadBlob/index.ts'

export function exportCSV(columns: string[], rows: unknown[][]) {
  const cell = (v: unknown) => {
    let text = v == null ? '' : String(v)
    if (/^[=+\-@\t\r]/.test(text)) text = "'" + text
    return '"' + text.replaceAll('"', '""') + '"'
  }
  const csv = '\uFEFF' + [columns, ...rows].map((row) => row.map(cell).join(',')).join('\r\n')
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `query-${Date.now()}.csv`)
}
