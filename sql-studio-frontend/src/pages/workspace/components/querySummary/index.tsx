import { Checkbox, Flex, Typography } from 'antd'
import type { TableColumnsType, TableRef } from 'antd'
import { useRef, useState } from 'react'

import { ResizableTable } from '@/components/resizableTable'
import type { DatabaseType } from '@/databases/typings'
import { useTranslation } from '@/hooks/useTranslation'
import type { ThemeMode } from '@/typings/theme'
import type { RunState, StatementRun } from '@/typings/workspace'

import { useTableViewportLayout } from '../../hooks/useTableViewportLayout'
import { batchRequestError, executionCancelled, statementDuration, statementErrorDetail, statementOutputs } from '../../utils/queryOutput'
import SQLPreview from '../sqlPreview'

type Props = { run: RunState; running: boolean; themeMode: ThemeMode; databaseType?: DatabaseType }
type SummaryRow = StatementRun & { key: number }
export default function QuerySummary({ run, running, themeMode, databaseType }: Props) {
  const { t, language } = useTranslation()

  const [errorsOnly, setErrorsOnly] = useState(false)
  const table = useRef<TableRef>(null)
  const { viewport, bodyHeight } = useTableViewportLayout()
  const statements = statementOutputs(run)
  const batchError = batchRequestError(run)
  const cancelled = statements.filter(executionCancelled).length
  const failed = statements.filter((item) => item.error && !executionCancelled(item)).length
  const columns: TableColumnsType<SummaryRow> = [
    {
      title: t('查询'),
      dataIndex: 'sql',
      width: 500,
      render: (sql: string) => (sql ? <SQLPreview compact sql={sql} themeMode={themeMode} databaseType={databaseType} /> : <Typography.Text type="secondary">{t('未记录语句')}</Typography.Text>)
    },
    {
      title: t('消息'),
      width: 300,
      render: (_, item) =>
        executionCancelled(item) ? (
          <Typography.Text type="secondary">{t('执行已取消')}</Typography.Text>
        ) : item.error ? (
          <Typography.Text type="danger" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {t((run.kind === 'query' ? statementErrorDetail(item) : undefined) ?? '执行失败')}
          </Typography.Text>
        ) : (
          <Typography.Text type="success" style={{ whiteSpace: 'pre-wrap' }}>
            {item.result && !item.result.columns.length && !item.result.writeFeedbackUnavailable ? t('OK，影响 {value1} 行', { value1: item.result.affectedRows }) : 'OK'}
          </Typography.Text>
        )
    },
    { title: t('查询耗时'), width: 120, render: (_, item) => (statementDuration(item) === undefined ? t('未记录') : `${statementDuration(item)} ms`) }
  ]
  return (
    <Flex vertical style={{ height: '100%', minHeight: 0 }}>
      <Flex wrap gap={24} align="center" style={{ padding: 12, flex: 'none', maxHeight: '50%', overflow: 'auto' }}>
        <div title={batchError ? t(batchError) : undefined}>
          {t('已处理：')}
          {statements.length} / {run.statementCount ?? statements.length}　{t('　成功：')}
          {statements.length - failed - cancelled}　{batchError ? t('批次失败，语句错误 {count}', { count: failed }) : t('　错误：') + failed}
          {executionCancelled(run) && <>　{t('执行已取消')}</>}
        </div>
        <div>
          {t('开始时间：')}
          {run.startedAt ? new Date(run.startedAt).toLocaleString(language, { hour12: false }) : t('未记录')}
          <br />
          {t('结束时间：')}
          {running ? t('执行中') : run.endedAt ? new Date(run.endedAt).toLocaleString(language, { hour12: false }) : t('未记录')}
          <br />
          {t('运行时间：')}
          {run.durationMs === undefined ? t('未记录') : `${run.durationMs} ms`}
        </div>
        <Checkbox
          checked={errorsOnly}
          onChange={(event) => {
            setErrorsOnly(event.target.checked)
            table.current?.scrollTo({ top: 0 })
          }}
          style={{ marginInlineStart: 'auto' }}
        >
          {t('仅显示错误')}
        </Checkbox>
      </Flex>
      <div ref={viewport} style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <ResizableTable<SummaryRow>
          ref={table}
          virtual
          resizeKey={run.id}
          columns={columns}
          rowKey="key"
          dataSource={statements.map((item, index) => ({ ...item, key: index })).filter((item) => !errorsOnly || (item.error && !executionCancelled(item)))}
          pagination={false}
          scroll={{ x: 920, y: bodyHeight || 24 }}
          locale={{ emptyText: running ? t('正在执行…') : errorsOnly ? t('没有错误记录') : t('暂无执行记录') }}
        />
      </div>
    </Flex>
  )
}
