import { CheckCircleOutlined, LoadingOutlined } from '@ant-design/icons'
import { Select, Tabs } from 'antd'

import { appearance } from '@/constant/appearance'
import type { RunState } from '@/typings/workspace'

import { resultTabLayout } from '../../constant/layout'
import { resultOutputs } from '../../utils/queryOutput'

type Props = {
  run: RunState
  running: boolean
  activeKey: string
  onChange: (key: string) => void
}
/** 消息、摘要与逐条结果共用一层受控导航。 */
export default function ResultTabs({ run, running, activeKey, onChange }: Props) {
  const results = resultOutputs(run)
  const compact = results.length > resultTabLayout.maximumVisibleTabs
  const indexedResults = results.map((entry, resultIndex) => ({ ...entry, resultIndex }))
  const visibleResults = compact ? indexedResults.filter(({ index }) => String(index) === activeKey) : indexedResults
  return (
    <Tabs
      className="statement-result-tabs"
      aria-label="输出内容"
      size={appearance.navigationSize}
      type="card"
      tabBarGutter={0}
      style={{ flex: 'none', minWidth: 0 }}
      tabBarStyle={{ margin: 0, background: 'var(--tab-bar-background)' }}
      activeKey={activeKey}
      onChange={onChange}
      tabBarExtraContent={
        compact ? (
          <Select
            aria-label="选择结果集"
            style={{ width: appearance.selectWidth }}
            disabled={running}
            placeholder={`选择结果集（共 ${results.length} 个）`}
            value={results.some(({ index }) => String(index) === activeKey) ? activeKey : undefined}
            options={indexedResults.map(({ index, resultIndex }) => ({ value: String(index), label: `结果 ${resultIndex + 1}（语句 ${index + 1}）` }))}
            onChange={onChange}
          />
        ) : undefined
      }
      items={[
        { key: 'messages', label: '消息', icon: running ? <LoadingOutlined spin /> : undefined },
        { key: 'summary', label: '摘要' },
        ...visibleResults.map(({ item, index, resultIndex }) => ({
          key: String(index),
          disabled: running,
          label: (
            <span
              className="statement-result-label"
              title={`语句 ${index + 1}\n${item.sql || run.title || ''}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap', color: 'inherit' }}
            >
              <CheckCircleOutlined />
              结果 {resultIndex + 1}
            </span>
          )
        }))
      ]}
    />
  )
}
