import { DownloadOutlined } from '@ant-design/icons'
import { Button, Flex } from 'antd'
import { useState } from 'react'

import { usePageError } from '@/contexts/pageErrors'
import { useTranslation } from '@/hooks/useTranslation'
import { exportXlsx } from '@/utils/xlsx'

import { excelData } from '../../../../utils/excelData'
import { CHAT } from '../../constant/chat'

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
  return (
    <Flex vertical align="start" gap={CHAT.spacing.detail}>
      <Button type="default" icon={<DownloadOutlined />} loading={busy} onClick={() => void download()}>
        {t('导出 Excel')}
        {data.truncated ? t('（当前截断结果）') : ''}
      </Button>
    </Flex>
  )
}
