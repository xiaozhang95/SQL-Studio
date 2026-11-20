import { downloadBlob } from '../downloadBlob'

type Note = { sheet: string; text: string }

export async function exportXlsx(headers: string[], rows: unknown[][], filename: string, sheetTitle: string, note?: Note) {
  const { Workbook } = await import('exceljs')
  const book = new Workbook()
  const sheet = book.addWorksheet(sheetTitle)
  sheet.addRow(headers)
  for (const row of rows) {
    sheet.addRow(row.map((value) => (value == null ? null : typeof value === 'object' ? JSON.stringify(value) : value)))
  }
  sheet.getRow(1).font = { bold: true }
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
  if (note) book.addWorksheet(note.sheet).addRow([note.text])
  const bytes = await book.xlsx.writeBuffer()
  downloadBlob(new Blob([new Uint8Array(bytes)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename)
}
