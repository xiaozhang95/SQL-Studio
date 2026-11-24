import { Checkbox, Flex, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import { useState } from 'react'

import { ResizableTable } from '@/components/resizableTable'
import { appearance } from '@/constant/appearance'
import type { DatabaseType } from '@/databases/typings'
import { useTablePagination } from '@/hooks/useTablePagination'
import { useTranslation } from '@/hooks/useTranslation'
import type { ThemeMode } from '@/typings/theme'
import type { RunState, StatementRun } from '@/typings/workspace'

import { executionCancelled, statementDuration, statementErrorDetail, statementOutputs } from '../../utils/queryOutput'
import SQLPreview from '../sqlPreview'

type Props = { run: RunState; running: boolean; themeMode: ThemeMode; databaseType?: DatabaseType }
export default function QuerySummary({ run, running, themeMode, databaseType }: Props) {
  const tablePagination = useTablePagination()

  const { t, language } = useTranslation()

  const [errorsOnly, setErrorsOnly] = useState(false)
  const [page, setPage] = useState(1)
  const statements = statementOutputs(run)
  const cancelled = statements.filter(executionCancelled).length
  const failed = statements.filter((item) => item.error && !executionCancelled(item)).length
  const columns: TableColumnsType<StatementRun> = [
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
            {item.result && !item.result.columns.length ? t('OK，影响 {value1} 行', { value1: item.result.affectedRows }) : 'OK'}
          </Typography.Text>
        )
    },
    { title: t('查询耗时'), width: 120, render: (_, item) => (statementDuration(item) === undefined ? t('未记录') : `${statementDuration(item)} ms`) }
  ]
  return (
    <div>
      <Flex wrap gap={24} align="center" style={{ padding: 12 }}>
        <div>
          {t('已处理：')}
          {statements.length} / {run.statementCount ?? statements.length}　{t('　成功：')}
          {statements.length - failed - cancelled}　{t('　错误：')}
          {failed}
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
            setPage(1)
          }}
          style={{ marginInlineStart: 'auto' }}
        >
          {t('仅显示错误')}
        </Checkbox>
      </Flex>
      <ResizableTable
        size={appearance.tableSize}
        resizeKey={run.id}
        columns={columns}
        rowKey="key"
        dataSource={statements.map((item, index) => ({ ...item, key: index })).filter((item) => !errorsOnly || (item.error && !executionCancelled(item)))}
        pagination={{ ...tablePagination, pageSize: 50, current: page, onChange: setPage }}
        scroll={{ x: 920 }}
        locale={{ emptyText: running ? t('正在执行…') : errorsOnly ? t('没有错误记录') : t('暂无执行记录') }}
      />
    </div>
  )
}
