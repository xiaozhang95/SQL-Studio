import { Checkbox, Flex, Table, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import { useState } from 'react'

import { appearance } from '@/constant/appearance'
import type { DatabaseType } from '@/databases/typings'
import type { ThemeMode } from '@/typings/theme'
import type { RunState, StatementRun } from '@/typings/workspace'

import { statementDuration, statementOutputs } from '../../utils/queryOutput'
import SQLPreview from '../sqlPreview'

type Props = { run: RunState; running: boolean; themeMode: ThemeMode; databaseType?: DatabaseType }
export default function QuerySummary({ run, running, themeMode, databaseType }: Props) {
  const [errorsOnly, setErrorsOnly] = useState(false)
  const statements = statementOutputs(run)
  const failed = statements.filter((item) => item.error).length
  const columns: TableColumnsType<StatementRun> = [
    {
      title: '查询',
      dataIndex: 'sql',
      width: 500,
      render: (sql: string) => (sql ? <SQLPreview compact sql={sql} themeMode={themeMode} databaseType={databaseType} /> : <Typography.Text type="secondary">未记录 SQL</Typography.Text>)
    },
    {
      title: '消息',
      width: 300,
      render: (_, item) => (
        <Typography.Text type={item.error ? 'danger' : 'success'} style={{ whiteSpace: 'pre-wrap' }}>
          {item.error || 'OK'}
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
        <Checkbox checked={errorsOnly} onChange={(event) => setErrorsOnly(event.target.checked)} style={{ marginInlineStart: 'auto' }}>
          仅显示错误
        </Checkbox>
      </Flex>
      <Table
        size={appearance.tableSize}
        columns={columns}
        rowKey="key"
        dataSource={statements.map((item, index) => ({ ...item, key: index })).filter((item) => !errorsOnly || item.error)}
        pagination={false}
        scroll={{ x: 920 }}
        locale={{ emptyText: running ? '正在执行…' : errorsOnly ? '没有错误记录' : '暂无执行记录' }}
      />
    </div>
  )
}
