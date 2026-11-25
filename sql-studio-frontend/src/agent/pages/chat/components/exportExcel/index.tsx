import { DownloadOutlined } from '@ant-design/icons'
import { Button, Tooltip } from 'antd'
import { useState } from 'react'

import { appearance } from '@/constant/appearance'
import { usePageError } from '@/contexts/pageErrors'
import { useTranslation } from '@/hooks/useTranslation'
import { exportXlsx } from '@/utils/xlsx'

import { excelData } from '../../../../utils/excelData'

export function ExportExcel({ value, title }: { value: unknown; title: string }) {
  const { t } = useTranslation()

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  usePageError(error)
  const data = excelData(value)
  if (!data) return null
  async function download() {
    if (!data) return
    setBusy(true)
    setError('')
    try {
      await exportXlsx(data.headers, data.rows, title.replace(/[\\/:*?"<>|]/g, '_') + '.xlsx', t('查询结果'))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Excel导出失败'))
    } finally {
      setBusy(false)
    }
  }
  const label = t('导出 Excel')
  const truncatedLabel = data.truncated ? `${label}${t('（当前截断结果）')}` : undefined
  return (
    <Tooltip title={truncatedLabel} trigger={['hover', 'focus']}>
      <Button type="primary" size={appearance.controlSize} aria-label={truncatedLabel} icon={<DownloadOutlined />} loading={busy} onClick={() => void download()}>
        {label}
      </Button>
    </Tooltip>
  )
}
