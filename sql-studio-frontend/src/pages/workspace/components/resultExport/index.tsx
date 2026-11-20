import { DownloadOutlined } from '@ant-design/icons'
import { Form, Modal, Radio } from 'antd'
import { useRef, useState } from 'react'

import ErrorNotice from '@/components/errorNotice'
import { useTranslation } from '@/hooks/useTranslation'
import type { QueryResult } from '@/typings/database'
import { exportCSV } from '@/utils/csv'
import { downloadBlob } from '@/utils/downloadBlob'
import { exportXlsx } from '@/utils/xlsx'

import ToolbarButton from '../toolbarButton'

const formats = ['CSV', 'Excel', 'JSON'] as const
type Format = (typeof formats)[number]
type Scope = 'loaded' | 'selected'

type Props = {
  result?: QueryResult
  selectedCount: number
  rows: (selected: boolean) => unknown[][]
  disabled: boolean
}

export default function ResultExport({ result, selectedCount, rows, disabled }: Props) {
  const { t } = useTranslation()
  const [target, setTarget] = useState<QueryResult>()
  const [format, setFormat] = useState<Format>('CSV')
  const [scope, setScope] = useState<Scope>('loaded')
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const [error, setError] = useState('')
  const open = Boolean(target && target === result)
  const blocked = disabled || busy || !result?.isQuery || result.truncatedBy === 'oversized-row'
  const cannotExport = blocked || (scope === 'selected' && !selectedCount)

  function show() {
    if (blocked || !result || lock.current) return
    setFormat('CSV')
    setScope('loaded')
    setError('')
    setTarget(result)
  }

  async function save() {
    if (!open || cannotExport || !result || lock.current) return
    lock.current = true
    setBusy(true)
    setError('')
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
      setTarget(undefined)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('导出失败'))
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  return (
    <>
      <ToolbarButton label={t('导出查询结果')} icon={<DownloadOutlined />} disabled={blocked} loading={busy} aria-haspopup="dialog" aria-expanded={open} onClick={show} />
      <Modal
        title={t('导出查询结果')}
        open={open}
        afterClose={() => setTarget((current) => (current === result ? current : undefined))}
        onOk={() => void save()}
        onCancel={() => {
          if (!lock.current) setTarget(undefined)
        }}
        okText={t('导出')}
        cancelText={t('取消')}
        confirmLoading={busy}
        okButtonProps={{ disabled: cannotExport }}
        cancelButtonProps={{ disabled: busy }}
        closable={!busy}
        mask={{ closable: !busy }}
        keyboard={!busy}
      >
        <ErrorNotice error={error} onClose={() => setError('')} style={{ marginBottom: 16 }} />
        <Form layout="horizontal" disabled={busy} labelCol={{ flex: '104px' }} wrapperCol={{ flex: '1 1 0' }}>
          <Form.Item label={t('导出格式')}>
            <Radio.Group aria-label={t('导出格式')} value={format} onChange={(event) => setFormat(event.target.value)} orientation="horizontal" options={[...formats]} />
          </Form.Item>
          <Form.Item label={t('导出范围')} extra={result?.truncated ? t('原查询结果已截断，文件仅包含已返回的数据。') : undefined} style={{ marginBottom: 0 }}>
            <Radio.Group
              aria-label={t('导出范围')}
              value={scope}
              onChange={(event) => setScope(event.target.value)}
              orientation="horizontal"
              options={[
                { value: 'loaded', label: t('已加载的筛选结果') },
                { value: 'selected', label: t('选中行（{value1}）', { value1: selectedCount }), disabled: !selectedCount }
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
