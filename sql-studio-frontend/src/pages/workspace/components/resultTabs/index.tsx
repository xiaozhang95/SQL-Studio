import { CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined } from '@ant-design/icons'
import { Tabs } from 'antd'

import { appearance } from '@/constant/appearance'
import type { RunState } from '@/typings/workspace'

import { statementOutputs } from '../../utils/queryOutput'

type Props = {
  run: RunState
  running: boolean
  activeKey: string
  onChange: (key: string) => void
}
/** 消息、摘要与逐条结果共用一层受控导航。 */
export default function ResultTabs({ run, running, activeKey, onChange }: Props) {
  const results = statementOutputs(run)
  return (
    <Tabs
      className="statement-result-tabs"
      aria-label="输出内容"
      size={appearance.navigationSize}
      type="card"
      tabBarGutter={0}
      style={{ flex: 'none', minWidth: 0 }}
      tabBarStyle={{ margin: 0, background: 'var(--surface-raised)' }}
      activeKey={activeKey}
      onChange={onChange}
      items={[
        { key: 'messages', label: '消息', icon: running ? <LoadingOutlined spin /> : undefined },
        { key: 'summary', label: '摘要' },
        ...results.map((item, index) => ({
          key: String(index),
          disabled: running,
          label: (
            <span
              className={`statement-result-label ${item.error ? 'is-error' : 'is-success'}`}
              title={item.sql || run.title}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap', color: item.error ? 'var(--ant-color-error-text)' : 'var(--ant-color-success-text)' }}
            >
              {item.error ? <CloseCircleOutlined /> : <CheckCircleOutlined />}结果 {index + 1}
            </span>
          )
        }))
      ]}
    />
  )
}
