import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import { Collapse, Empty, Space, Typography } from 'antd'

import type { DatabaseType } from '@/databases/typings'
import type { ThemeMode } from '@/typings/theme'
import type { RunState } from '@/typings/workspace'

import { statementDuration, statementOutputs } from '../../utils/queryOutput'
import SQLPreview from '../sqlPreview'

type Props = { run: RunState; running: boolean; themeMode: ThemeMode; databaseType?: DatabaseType }
export default function QueryMessages({ run, running, themeMode, databaseType }: Props) {
  const statements = statementOutputs(run)
  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Collapse
        key={`${run.id}:${statements.flatMap((item, index) => (item.error ? [index] : [])).join(',')}`}
        defaultActiveKey={statements.flatMap((item, index) => (item.error ? [String(index)] : []))}
        items={statements.map((item, index) => ({
          key: String(index),
          label: (
            <Space wrap>
              <Typography.Text>语句 {index + 1}</Typography.Text>
              <Typography.Text type={item.error ? 'danger' : 'success'}>
                {item.error ? <CloseCircleOutlined /> : <CheckCircleOutlined />} {item.error ? '执行失败' : '执行成功'}
              </Typography.Text>
              <Typography.Text type="secondary">{statementDuration(item) === undefined ? '耗时未记录' : `${statementDuration(item)} ms`}</Typography.Text>
            </Space>
          ),
          children: (
            <section aria-label={`语句 ${index + 1} 执行消息`}>
              {item.sql ? <SQLPreview compact sql={item.sql} themeMode={themeMode} databaseType={databaseType} /> : <div>此结果未记录执行语句</div>}
              <Typography.Paragraph type={item.error ? 'danger' : 'success'} style={{ whiteSpace: 'pre-wrap', marginBlock: '8px 0' }}>
                {item.error || (item.result?.columns.length ? 'OK' : `OK，影响 ${item.result?.affectedRows ?? 0} 行`)}
              </Typography.Paragraph>
            </section>
          )
        }))}
      />
      {running && <Typography.Text type="secondary">正在执行，消息随已完成语句更新…</Typography.Text>}
      {!running && !statements.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无执行消息" />}
    </div>
  )
}
