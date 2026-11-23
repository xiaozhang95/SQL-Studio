import { DownloadOutlined } from '@ant-design/icons'
import { Button, Flex, Tooltip } from 'antd'
import { useState } from 'react'

import { usePageError } from '@/contexts/pageErrors'
import { useTranslation } from '@/hooks/useTranslation'
import { exportXlsx } from '@/utils/xlsx'

import { excelData } from '../../../../utils/excelData'
import { CHAT } from '../../constant/chat'

export function ExportExcel({ value, title, variant = 'button' }: { value: unknown; title: string; variant?: 'button' | 'icon' | 'link' }) {
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
  const label = `${t('导出 Excel')}${data.truncated ? t('（当前截断结果）') : ''}`
  if (variant === 'icon')
    return (
      <Tooltip title={label}>
        <Button type="text" size="small" aria-label={label} icon={<DownloadOutlined />} loading={busy} onClick={() => void download()} />
      </Tooltip>
    )
  return (
    <Flex vertical align="start" gap={CHAT.spacing.detail}>
      <Button
        type={variant === 'link' ? 'text' : 'default'}
        size={variant === 'link' ? 'small' : undefined}
        className={variant === 'link' ? 'agent-action-link' : undefined}
        icon={<DownloadOutlined />}
        loading={busy}
        onClick={() => void download()}
      >
        {label}
      </Button>
    </Flex>
  )
}
