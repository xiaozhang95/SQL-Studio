import { DownloadOutlined } from '@ant-design/icons'
import { Dropdown } from 'antd'
import { useRef, useState } from 'react'

import { usePageError } from '@/contexts/pageErrors'
import { useTranslation } from '@/hooks/useTranslation'
import type { QueryResult } from '@/typings/database'
import { exportCSV } from '@/utils/csv'
import { downloadBlob } from '@/utils/downloadBlob'
import { exportXlsx } from '@/utils/xlsx'

import ToolbarButton from '../toolbarButton'

const formats = ['CSV', 'Excel', 'JSON'] as const

type Props = {
  result?: QueryResult
  selectedCount: number
  rows: (selected: boolean) => unknown[][]
  disabled: boolean
}

export default function ResultExport({ result, selectedCount, rows, disabled }: Props) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const [error, setError] = useState<{ result: QueryResult; message: string }>()
  usePageError(error && error.result === result ? error.message : undefined)
  const blocked = disabled || busy || !result?.isQuery || result.truncatedBy === 'oversized-row'

  async function save(key: string) {
    if (blocked || !result || lock.current) return
    const [format, scope] = key.split('/')
    if (scope === 'selected' && !selectedCount) return
    lock.current = true
    setBusy(true)
    setError(undefined)
    try {
      const cells = rows(scope === 'selected')
      const headers = result.columns.map((column) => column.name)
      if (format === 'CSV') exportCSV(headers, cells)
      else if (format === 'JSON') {
        const data = { columns: result.columns, rows: cells, truncated: result.truncated, truncatedBy: result.truncatedBy }
        downloadBlob(new Blob([JSON.stringify(data)], { type: 'application/json;charset=utf-8' }), `query-${Date.now()}.json`)
      } else if (format === 'Excel') {
        // Keep the complete text available through JSON when it exceeds Excel's cell limit.
        if ([headers, ...cells].some((row) => row.some((value) => typeof value === 'string' && value.length > 32767))) {
          throw new Error(t('Excel 单元格文本过长，请改用 JSON 导出'))
        }
        const note = result.truncated ? { sheet: t('导出说明'), text: t('原查询结果已截断，文件仅包含已返回的数据。') } : undefined
        await exportXlsx(headers, cells, `query-${Date.now()}.xlsx`, t('查询结果'), note)
      }
    } catch (reason) {
      setError({ result, message: reason instanceof Error ? reason.message : t('导出失败') })
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  return (
    <Dropdown
      disabled={blocked}
      trigger={['click']}
      menu={{
        items: formats.map((format) => ({
          key: format,
          label: format,
          children: [
            { key: format + '/loaded', label: t('导出已加载结果') },
            { key: format + '/selected', label: t('导出选中（{value1}）', { value1: selectedCount }), disabled: !selectedCount }
          ]
        })),
        onClick: ({ key }) => void save(key)
      }}
    >
      <ToolbarButton label={t('导出查询结果')} icon={<DownloadOutlined />} disabled={blocked} loading={busy} aria-haspopup="menu" />
    </Dropdown>
  )
}
