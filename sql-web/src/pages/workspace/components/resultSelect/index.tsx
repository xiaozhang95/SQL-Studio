import { CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined, TableOutlined } from '@ant-design/icons'
import { Select } from 'antd'

import { appearance } from '@/constant/appearance'
import type { RunState, StatementRun } from '@/typings/workspace'

type Props = { run: RunState; running: boolean; resultIndex: number; onChange: (index: number) => void }
const summary = (item: StatementRun, index: number) => `结果 ${index + 1} · ${item.error ? '失败' : '成功'} · ${item.sql.replace(/\s+/g, ' ')}`

/** 图标、文案和颜色共用选中结果，状态始终位于选择器内部。 */
export default function ResultSelect({ run, running, resultIndex, onChange }: Props) {
  const results = run.statements?.length ? run.statements : run.result || run.error ? [{ ...run, sql: run.title || '查询结果' }] : []
  const index = results.length ? (run.statements?.length ? Math.min(Math.max(resultIndex, 0), results.length - 1) : 0) : undefined
  const selected = index === undefined ? undefined : results[index]
  const status = running ? '' : selected?.error ? 'is-error' : selected?.result ? 'is-success' : ''
  const pending = running ? `执行中 · 共 ${run.statementCount || 1} 条` : '暂无结果'
  return (
    <Select
      aria-label="选择语句结果"
      className={`statement-result-select ${status}`}
      classNames={{ prefix: 'statement-result-prefix', content: 'statement-result-content', suffix: 'statement-result-suffix', popup: { root: 'result-select-popup' } }}
      style={{ width: appearance.selectWidth }}
      prefix={running ? <LoadingOutlined spin /> : selected?.error ? <CloseCircleOutlined /> : selected?.result ? <CheckCircleOutlined /> : <TableOutlined />}
      value={index}
      placeholder={pending}
      labelRender={() => (running || !selected || index === undefined ? pending : summary(selected, index))}
      disabled={running}
      onChange={onChange}
      options={results.map((item, itemIndex) => ({
        value: itemIndex,
        'aria-label': `结果 ${itemIndex + 1} · ${item.error ? '失败' : '成功'}`,
        className: `result-option ${item.error ? 'is-error' : 'is-success'}`,
        label: (
          <span className={`statement-result-label ${item.error ? 'is-error' : 'is-success'}`}>
            {item.error ? <CloseCircleOutlined /> : <CheckCircleOutlined />}
            <span className="statement-result-text">{summary(item, itemIndex)}</span>
          </span>
        ),
        title: item.sql
      }))}
    />
  )
}
