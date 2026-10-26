import { Empty, Typography } from 'antd'

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
      {statements.map((item, index) => (
        <section key={index} aria-label={`语句 ${index + 1} 执行消息`}>
          <Typography.Text type="secondary">语句 {index + 1}</Typography.Text>
          {item.sql ? <SQLPreview sql={item.sql} themeMode={themeMode} databaseType={databaseType} /> : <div>此结果未记录执行 SQL</div>}
          <Typography.Paragraph type={item.error ? 'danger' : 'success'} style={{ whiteSpace: 'pre-wrap', marginBlock: '8px 0' }}>
            {item.error || (item.result?.isQuery ? 'OK' : `OK，影响 ${item.result?.affectedRows ?? 0} 行`)}
          </Typography.Paragraph>
          <Typography.Text type="secondary">查询耗时：{statementDuration(item) === undefined ? '未记录' : `${statementDuration(item)} ms`}</Typography.Text>
        </section>
      ))}
      {running && <Typography.Text type="secondary">正在执行，消息随已完成语句更新…</Typography.Text>}
      {!running && !statements.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无执行消息" />}
    </div>
  )
}
