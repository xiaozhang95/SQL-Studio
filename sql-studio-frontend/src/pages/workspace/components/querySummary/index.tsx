import { Checkbox, Flex, Table, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import { useState } from 'react'

import ErrorNotice from '@/components/errorNotice'
import { appearance } from '@/constant/appearance'
import { tablePaginationDefaults } from '@/constant/tablePagination'
import type { DatabaseType } from '@/databases/typings'
import type { ThemeMode } from '@/typings/theme'
import type { RunState, StatementRun } from '@/typings/workspace'

import { statementDuration, statementOutputs } from '../../utils/queryOutput'
import SQLPreview from '../sqlPreview'

type Props = { run: RunState; running: boolean; themeMode: ThemeMode; databaseType?: DatabaseType }
export default function QuerySummary({ run, running, themeMode, databaseType }: Props) {
  const [errorsOnly, setErrorsOnly] = useState(false)
  const [page, setPage] = useState(1)
  const statements = statementOutputs(run)
  const failed = statements.filter((item) => item.error).length
  const columns: TableColumnsType<StatementRun> = [
    {
      title: '查询',
      dataIndex: 'sql',
      width: 500,
      render: (sql: string) => (sql ? <SQLPreview compact sql={sql} themeMode={themeMode} databaseType={databaseType} /> : <Typography.Text type="secondary">未记录语句</Typography.Text>)
    },
    {
      title: '消息',
      width: 300,
      render: (_, item) =>
        item.error ? (
          <ErrorNotice error={item.error} />
        ) : (
          <Typography.Text type="success" style={{ whiteSpace: 'pre-wrap' }}>
            {item.result && !item.result.columns.length ? `OK，影响 ${item.result.affectedRows} 行` : 'OK'}
          </Typography.Text>
        )
    },
    { title: '查询耗时', width: 120, render: (_, item) => (statementDuration(item) === undefined ? '未记录' : `${statementDuration(item)} ms`) }
  ]
  return (
    <div>
      <Flex wrap gap={24} align="center" style={{ padding: 12 }}>
        <div>
          已处理：{statements.length} / {run.statementCount ?? statements.length}　成功：{statements.length - failed}　错误：{failed}
        </div>
        <div>
          开始时间：{run.startedAt ? new Date(run.startedAt).toLocaleString('zh-CN', { hour12: false }) : '未记录'}
          <br />
          结束时间：{running ? '执行中' : run.endedAt ? new Date(run.endedAt).toLocaleString('zh-CN', { hour12: false }) : '未记录'}
          <br />
          运行时间：{run.durationMs === undefined ? '未记录' : `${run.durationMs} ms`}
        </div>
        <Checkbox
          checked={errorsOnly}
          onChange={(event) => {
            setErrorsOnly(event.target.checked)
            setPage(1)
          }}
          style={{ marginInlineStart: 'auto' }}
        >
          仅显示错误
        </Checkbox>
      </Flex>
      <Table
        size={appearance.tableSize}
        columns={columns}
        rowKey="key"
        dataSource={statements.map((item, index) => ({ ...item, key: index })).filter((item) => !errorsOnly || item.error)}
        pagination={{ ...tablePaginationDefaults, pageSize: 50, current: page, onChange: setPage }}
        scroll={{ x: 920 }}
        locale={{ emptyText: running ? '正在执行…' : errorsOnly ? '没有错误记录' : '暂无执行记录' }}
      />
    </div>
  )
}
