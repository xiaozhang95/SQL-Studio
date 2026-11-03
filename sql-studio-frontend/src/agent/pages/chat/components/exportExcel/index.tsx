import { DownloadOutlined } from '@ant-design/icons'
import { Alert, Button, Flex } from 'antd'
import { useState } from 'react'

import { excelData } from '../../../../utils/excelData'

export function ExportExcel({ value, title }: { value: unknown; title: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const data = excelData(value)
  if (!data) return null
  async function download() {
    if (!data) return
    setBusy(true)
    setError('')
    try {
      const { Workbook } = await import('exceljs')
      const book = new Workbook()
      const sheet = book.addWorksheet('查询结果')
      sheet.addRow(data.headers)
      for (const row of data.rows)
        sheet.addRow(row.map((v) => (v === null || v === undefined ? null : typeof v === 'number' || typeof v === 'boolean' ? v : typeof v === 'string' ? v : JSON.stringify(v))))
      sheet.getRow(1).font = { bold: true }
      sheet.views = [{ state: 'frozen', ySplit: 1 }]
      const bytes = await book.xlsx.writeBuffer()
      const blob = new Blob([new Uint8Array(bytes)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = title.replace(/[\\/:*?"<>|]/g, '_') + '.xlsx'
      document.body.append(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Excel导出失败')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Flex vertical align="start" gap="small" style={{ marginTop: 12 }}>
      <Button type="primary" icon={<DownloadOutlined />} loading={busy} onClick={() => void download()}>
        导出 Excel{data.truncated ? '（当前截断结果）' : ''}
      </Button>
      {error && <Alert type="error" title={error} />}
    </Flex>
  )
}
